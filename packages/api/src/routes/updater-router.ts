import express from 'express';
import { InternalServiceAuth, RouteConstants, SelfUpdatePlanner, SystemUpdateService } from '@fromcode119/core';
import { UpdaterStatusStore } from '@api/services/system/updater-status-store';

/**
 * The updater service's two questions to the api: what should I install now, and here is how it went.
 *
 * Secret-only, the header `InternalServiceAuth` names — the same as the routing map. The updater is part
 * of the deployment and holds the deployment's secret; nothing outside it can ask, or report.
 */
export class UpdaterRouter {
  readonly router = express.Router();

  constructor(private readonly store: UpdaterStatusStore) {
    this.router.get(RouteConstants.SEGMENTS.INTERNAL_UPDATER_PLAN, (req, res) => { void this.plan(req, res); });
    this.router.post(RouteConstants.SEGMENTS.INTERNAL_UPDATER_STATUS, express.json(), (req, res) => { void this.report(req, res); });
  }

  private authorized(req: express.Request, res: express.Response): boolean {
    if (InternalServiceAuth.isConfigured() && InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) return true;
    res.status(401).json({ error: 'internal_secret_required' });
    return false;
  }

  private async plan(req: express.Request, res: express.Response): Promise<void> {
    if (!this.authorized(req, res)) return;
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await SelfUpdatePlanner.plan(SystemUpdateService.installedVersion()));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  private async report(req: express.Request, res: express.Response): Promise<void> {
    if (!this.authorized(req, res)) return;
    try {
      await this.store.report((req.body ?? {}) as Record<string, unknown>);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
