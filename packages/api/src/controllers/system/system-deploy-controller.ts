import { Request, Response } from 'express';
import {
  ApplicationRestartService,
  ApplicationUrlUtils,
  AuditOutcome,
  BaseController,
  CoercionUtils,
  InternalServiceAuth,
} from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/**
 * Operator-triggered restarts of this deployment's apps.
 *
 * The permission is checked on the route (`system:deploy:restart`, the same one the `deploy.restart`
 * MCP tool requires); this controller decides nothing about authority. It validates which app was
 * asked for, records the attempt in the audit log with the actor on it — a restart is downtime, so it
 * must be attributable — and answers with what actually happened, including the reason when nothing
 * did.
 */
export class SystemDeployController extends BaseController {
  private readonly restarts: ApplicationRestartService;

  constructor(private readonly runtime: SystemControllerRuntime) {
    super();
    this.restarts = new ApplicationRestartService(runtime.manager.logger);
  }

  /**
   * The apps this install can restart, and whether each one is actually reachable.
   *
   * The admin renders its buttons from this rather than from a hardcoded list, so an operator can see
   * BEFORE clicking that (say) the frontend has no internal URL configured — instead of pressing a
   * button that looks live and getting a failure.
   */
  async listApps(_req: Request, res: Response) {
    const secretConfigured = InternalServiceAuth.isConfigured();
    res.json({
      secretEnvKey: InternalServiceAuth.ENV_KEY,
      secretConfigured,
      apps: ApplicationRestartService.APPS.map((app) => {
        // The api exits in place, so it calls nothing and needs neither a URL nor the secret.
        const isSelf = app === ApplicationUrlUtils.API_APP;
        const url = isSelf ? '' : ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment(app);
        return { app, url, restartable: isSelf || (secretConfigured && Boolean(url)) };
      }),
    });
  }

  async restart(req: Request, res: Response) {
    const app = CoercionUtils.toKey(req.body?.app);
    if (!ApplicationRestartService.supports(app)) {
      res.status(400).json({
        error: `Unknown app "${app}".`,
        supported: ApplicationRestartService.APPS,
      });
      return;
    }

    const actor = (req as any).user || {};
    const requestedBy = `user ${String(actor.id || 'unknown')} (${String(actor.email || 'unknown')})`;
    const outcome = await this.restarts.restart(app, requestedBy);

    void this.runtime.manager.audit.logAction(
      'system',
      'deploy.restart',
      app,
      outcome.restarting ? AuditOutcome.ALLOWED : AuditOutcome.DENIED,
      { userId: actor.id ?? null, email: actor.email ?? null, reason: outcome.reason || undefined },
    );

    if (outcome.restarting) {
      res.json(outcome.toJSON());
      return;
    }
    // A refusal is a 409, not a 500: nothing broke, the restart just did not happen. `error` carries
    // the reason because that is the key every admin client reads a failure message from — a refusal
    // the operator cannot read is the same as no answer.
    res.status(409).json({ ...outcome.toJSON(), error: outcome.reason });
  }
}
