import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { InternalServiceAuth } from '@core/security/internal-service-auth';
import { ApplicationRestartOutcome } from '@core/management/application-restart-outcome';
import { ProcessRestartService } from '@core/management/process-restart-service';

/**
 * Restarts one app of this deployment on an operator's behalf.
 *
 * The api restarts itself the same way it always has — a clean exit the supervisor reverses. The admin
 * and frontend are separate processes the api cannot signal, so each of them serves
 * `INTERNAL_APP_PATH.RESTART`, and this service calls it with the shared internal secret. The
 * operator's authority was already checked by the route that reached here; the secret only proves the
 * call came from inside the deployment.
 *
 * Nothing here guesses. No secret, no URL, no answer from the app — each comes back as a stated reason
 * on the outcome, never as a silent success.
 */
export class ApplicationRestartService {
  /** The apps an operator can restart, in the order the admin lists them. */
  static readonly APPS = [
    ApplicationUrlUtils.API_APP,
    ApplicationUrlUtils.ADMIN_APP,
    ApplicationUrlUtils.FRONTEND_APP,
  ] as const;

  private static readonly REQUEST_TIMEOUT_MS = 5000;

  constructor(private readonly logger?: { warn(message: string): void }) {}

  static supports(app: string): boolean {
    return (ApplicationRestartService.APPS as readonly string[]).includes(String(app || '').trim().toLowerCase());
  }

  async restart(app: string, requestedBy: string): Promise<ApplicationRestartOutcome> {
    const target = String(app || '').trim().toLowerCase();
    if (!ApplicationRestartService.supports(target)) {
      return ApplicationRestartOutcome.refused(target, `Unknown app "${target}".`);
    }

    if (target === ApplicationUrlUtils.API_APP) {
      const exit = ProcessRestartService.scheduleExit(`api restart requested by ${requestedBy}`, this.logger);
      return exit.scheduled
        ? ApplicationRestartOutcome.restarting(target, exit.exitInMs)
        : ApplicationRestartOutcome.refused(target, 'Process exit is disabled while NODE_ENV=test.');
    }

    return ApplicationRestartService.requestRemoteRestart(target);
  }

  /**
   * Everything that must hold BEFORE a request carrying the secret is allowed to leave this process:
   * a secret to present, and an address this deployment actually declared for that app. Returns the
   * URL to call, or the outcome explaining why nothing will be called.
   */
  private static resolveRestartTarget(app: string): { url: string } | ApplicationRestartOutcome {
    if (!InternalServiceAuth.isConfigured()) {
      return ApplicationRestartOutcome.refused(
        app,
        `${InternalServiceAuth.ENV_KEY} is not set, so the ${app} app cannot verify this call. Set the same value on the api, admin and frontend services.`,
      );
    }

    // Deployment-declared only — see `readAppInternalBaseUrlFromEnvironment`. Empty means this
    // deployment never said where that app runs, which on an api+admin install is the truthful answer
    // for the frontend: it does not run one, so there is nothing to restart and nothing to send a
    // secret to.
    const baseUrl = ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment(app);
    if (!baseUrl) {
      return ApplicationRestartOutcome.refused(
        app,
        `This deployment has not declared where the ${app} app runs. Set INTERNAL_${app.toUpperCase()}_URL (or ${app.toUpperCase()}_URL) on the api service if it runs one.`,
      );
    }

    // The app's own base path counts: the admin Next app is served under one (`ADMIN_URL`'s path, or
    // `NEXT_PUBLIC_ADMIN_BASE_PATH`), so its routes — this one included — all live beneath it.
    const basePath = ApplicationUrlUtils.readAppBasePathFromEnvironment(app);
    return { url: ApplicationUrlUtils.joinApiPath(baseUrl, `${basePath}${SystemConstants.INTERNAL_APP_PATH.RESTART}`) };
  }

  private static async requestRemoteRestart(app: string): Promise<ApplicationRestartOutcome> {
    const target = ApplicationRestartService.resolveRestartTarget(app);
    if (target instanceof ApplicationRestartOutcome) return target;

    const { url } = target;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ApplicationRestartService.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...InternalServiceAuth.requestHeaders(), 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return ApplicationRestartOutcome.refused(app, `The ${app} app answered ${response.status} at ${url}.`);
      }
      const payload = await response.json().catch(() => null) as
        { app?: string; restarting?: boolean; exitInMs?: number; reason?: string } | null;
      if (!payload?.restarting) {
        return ApplicationRestartOutcome.refused(app, payload?.reason || `The ${app} app did not confirm a restart.`);
      }
      // The answer must NAME itself as the app we asked. Without this, "restarted" was inferred from
      // any host willing to return `{"restarting":true}` — so a stale or wrong URL would be reported
      // to the operator as a successful restart of an app that never heard the request.
      if (payload.app !== app) {
        return ApplicationRestartOutcome.refused(
          app,
          `The host at ${url} answered as "${String(payload.app || 'unknown')}", not the ${app} app.`,
        );
      }
      return ApplicationRestartOutcome.restarting(app, Number(payload.exitInMs) || 0);
    } catch (error) {
      return ApplicationRestartOutcome.refused(app, `The ${app} app could not be reached at ${url}: ${(error as Error)?.message || error}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
