import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { ApplicationUrlUtils, EdgeAlerts, EdgeIdentity, EdgeStopStore } from '@fromcode119/core';
import { EdgeInternalRouter } from '@api/routes/edge-internal-router';
import { EdgeIdentityInternalRouter } from '@api/routes/edge-identity-internal-router';
import { EdgeStopAdminRouter } from '@api/routes/edge-stop-admin-router';
import { EdgeStopAdminService } from '@api/services/security/edge-stop-admin-service';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * The routes around the addresses the gateway stopped as scanners, over one store: Settings → Security →
 * Stopped addresses (platform admins only), and what the gateway reports — a stop, refusals, its
 * watchdog restarting it (secret-only) — and edge identity: what the gateway forwards from the control
 * channel (secret-only). The store is also what the routing map carries back to the gateway.
 */
export class EdgeRoutesMount {
  readonly stops: EdgeStopStore;
  readonly identity: EdgeIdentity;

  constructor(private readonly manager: any, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard, settingsCache: Map<string, string>) {
    this.stops = new EdgeStopStore(manager.db);
    this.identity = new EdgeIdentity(manager.db, settingsCache, () => EdgeRoutesMount.apiHost());
  }

  /** Both route sets, the admin's under `adminPath`; returns the store the routing map reads. */
  mount(api: express.Router, adminPath: string): EdgeStopStore {
    api.use(adminPath, new EdgeStopAdminRouter(new EdgeStopAdminService(this.manager, this.stops), this.auth, this.platformAdmin).router);
    api.use(new EdgeInternalRouter(this.stops, new EdgeAlerts(this.manager)).router);
    api.use(new EdgeIdentityInternalRouter(this.manager, this.identity).router);
    return this.stops;
  }

  /** The platform's API host — what edge identities are issued under. Empty until the API URL is set. */
  private static apiHost(): string {
    const base = ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP);
    try { return base ? new URL(base).hostname : ''; } catch { return ''; }
  }
}
