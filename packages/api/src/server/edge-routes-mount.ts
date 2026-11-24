import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { EdgeAlerts, EdgeStopStore } from '@fromcode119/core';
import { EdgeInternalRouter } from '@api/routes/edge-internal-router';
import { EdgeStopAdminRouter } from '@api/routes/edge-stop-admin-router';
import { EdgeStopAdminService } from '@api/services/security/edge-stop-admin-service';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * The routes around the addresses the gateway stopped as scanners, over one store: Settings → Security →
 * Stopped addresses (platform admins only), and what the gateway reports — a stop, refusals, its
 * watchdog restarting it (secret-only). The store is also what the routing map carries back to the gateway.
 */
export class EdgeRoutesMount {
  readonly stops: EdgeStopStore;

  constructor(private readonly manager: any, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard) {
    this.stops = new EdgeStopStore(manager.db);
  }

  /** Both route sets, the admin's under `adminPath`; returns the store the routing map reads. */
  mount(api: express.Router, adminPath: string): EdgeStopStore {
    api.use(adminPath, new EdgeStopAdminRouter(new EdgeStopAdminService(this.manager, this.stops), this.auth, this.platformAdmin).router);
    api.use(new EdgeInternalRouter(this.stops, new EdgeAlerts(this.manager)).router);
    return this.stops;
  }
}
