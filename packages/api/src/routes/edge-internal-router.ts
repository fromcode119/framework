import express from 'express';
import { CoercionUtils, EdgeAlerts, EdgeStopStore, InternalServiceAuth, Logger, RouteConstants } from '@fromcode119/core';

/**
 * What the gateway reports about what it did on its own. Secret-only, like the routing map: no secret
 * configured, nothing answers.
 *
 * - `POST /internal/edge/stops` `{ stop }` — it stopped an address as a scanner; recorded, and the
 *   administrators told (`EdgeAlerts`). `{ refused: { address: n } }` — requests it refused from stopped
 *   addresses since its last report.
 * - `POST /internal/edge/events` `{ kind: 'gateway_restarted', reason }` — its watchdog is restarting it.
 */
export class EdgeInternalRouter {
  static readonly RESTARTED = 'gateway_restarted';
  readonly router = express.Router();
  private readonly logger = new Logger({ namespace: 'edge-internal' });

  constructor(private readonly stops: EdgeStopStore, private readonly alerts: EdgeAlerts) {
    this.router.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_STOPS, (req, res) => { void this.report(req, res); });
    this.router.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_EVENTS, (req, res) => { void this.event(req, res); });
  }

  private authorized(req: express.Request, res: express.Response): boolean {
    res.setHeader('Cache-Control', 'no-store');
    if (InternalServiceAuth.isConfigured() && InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) return true;
    res.status(401).json({ error: 'internal_secret_required' });
    return false;
  }

  private async report(req: express.Request, res: express.Response): Promise<void> {
    if (!this.authorized(req, res)) return;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const raw = (body.stop ?? null) as Record<string, unknown> | null;
      let recorded = false;
      if (raw) {
        const stop = await this.stops.record({
          address: CoercionUtils.toString(raw.address),
          reason: CoercionUtils.toString(raw.reason),
          until: CoercionUtils.toString(raw.until),
          strikes: CoercionUtils.toNumber(raw.strikes, 0),
          hosts: Array.isArray(raw.hosts) ? raw.hosts.map(String) : [],
          paths: Array.isArray(raw.paths) ? raw.paths.map(String) : [],
        });
        recorded = stop !== null;
        if (stop?.isNew) void this.alerts.scannerStopped(stop);
      }
      const refused = body.refused && typeof body.refused === 'object' ? body.refused as Record<string, unknown> : null;
      if (refused) await this.stops.addRefused(refused);
      res.json({ ok: true, recorded });
    } catch (error: any) {
      this.logger.error(`Could not record the gateway's report: ${error?.message || error}`);
      res.status(500).json({ error: 'not_recorded' });
    }
  }

  private async event(req: express.Request, res: express.Response): Promise<void> {
    if (!this.authorized(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (CoercionUtils.toString(body.kind) !== EdgeInternalRouter.RESTARTED) {
      res.status(400).json({ error: 'unknown_event' });
      return;
    }
    const reason = CoercionUtils.toString(body.reason).slice(0, 500);
    this.logger.warn(`The gateway's watchdog is restarting it: ${reason}`);
    await this.alerts.gatewayRestarted(reason, new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    res.json({ ok: true });
  }
}
