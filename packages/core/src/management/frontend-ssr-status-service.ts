import { ApplicationUrlUtils } from '@core/application-url-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { InternalServiceAuth } from '@core/security/internal-service-auth';

/**
 * Asks the frontend what it can see of the theme and plugin server bundles it renders from.
 *
 * The api cannot answer this itself, and that is the entire point: the api and the frontend are
 * separate containers, and the failure this diagnoses is precisely them disagreeing about what is on
 * disk. The api can list a theme's `ui-ssr/` files all day while the frontend — the process that
 * actually server-renders — sees nothing there, and the only visible symptom is pages with no content.
 *
 * Read-only, and it fails the same way {@link ApplicationRestartService} does: every reason a question
 * could not be answered comes back stated, never as a silent empty result.
 */
export class FrontendSsrStatusService {
  private static readonly REQUEST_TIMEOUT_MS = 5000;

  /** The report, or `{ error }` explaining why the frontend could not be asked. */
  static async read(): Promise<Record<string, unknown>> {
    const app = ApplicationUrlUtils.FRONTEND_APP;

    if (!InternalServiceAuth.isConfigured()) {
      return {
        app,
        error: `${InternalServiceAuth.ENV_KEY} is not set, so the ${app} app cannot verify this call. Set the same value on the api, admin and frontend services.`,
      };
    }

    const baseUrl = ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment(app);
    if (!baseUrl) {
      return {
        app,
        error: `This deployment has not declared where the ${app} app runs. Set INTERNAL_${app.toUpperCase()}_URL (or ${app.toUpperCase()}_URL) on the api service if it runs one.`,
      };
    }

    const basePath = ApplicationUrlUtils.readAppBasePathFromEnvironment(app);
    const url = ApplicationUrlUtils.joinApiPath(baseUrl, `${basePath}${SystemConstants.INTERNAL_APP_PATH.SSR_STATUS}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FrontendSsrStatusService.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: InternalServiceAuth.requestHeaders(),
        signal: controller.signal,
      });
      if (!response.ok) {
        // A 404 here is itself a finding: the frontend is running a build from before this endpoint
        // existed, which is worth saying plainly rather than reporting as a generic failure.
        const hint = response.status === 404
          ? ` The ${app} app is running a build that predates this endpoint — rebuild its image to diagnose it remotely.`
          : '';
        return { app, error: `The ${app} app answered ${response.status} at ${url}.${hint}` };
      }
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (payload?.app !== app) {
        return { app, error: `The host at ${url} answered as "${String(payload?.app || 'unknown')}", not the ${app} app.` };
      }
      return payload;
    } catch (error) {
      return { app, error: `The ${app} app could not be reached at ${url}: ${(error as Error)?.message || error}` };
    } finally {
      clearTimeout(timer);
    }
  }
}
