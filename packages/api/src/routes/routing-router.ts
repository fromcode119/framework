import express from 'express';
import { ApplicationUrlUtils, InternalServiceAuth, RouteConstants, TenantRouteMap } from '@fromcode119/core';
import type { TenantRegistryService } from '@fromcode119/core';

/**
 * `GET /internal/routing` — the host → app map the platform gateway routes by (T6 §3.1).
 *
 * Built from the tenant table on every call (it is small, and the gateway caches it); the platform's
 * own hosts come from the deployment's public app URLs. Secret-only: the header `InternalServiceAuth`
 * names, the same one the operator restart endpoints use. No secret configured → the route does not
 * answer at all, so a deployment that never set one exposes nothing.
 */
export class RoutingRouter {
  readonly router = express.Router();

  constructor(private readonly tenants: TenantRegistryService) {
    this.router.get(RouteConstants.SEGMENTS.INTERNAL_ROUTING, (req, res) => { void this.map(req, res); });
  }

  private async map(req: express.Request, res: express.Response): Promise<void> {
    if (!InternalServiceAuth.isConfigured() || !InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) {
      res.status(401).json({ error: 'internal_secret_required' });
      return;
    }
    const map = TenantRouteMap.build(await this.tenants.list(), {
      admin: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP),
      api: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
      frontend: ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...map.toJSON(), generatedAt: new Date().toISOString() });
  }
}
