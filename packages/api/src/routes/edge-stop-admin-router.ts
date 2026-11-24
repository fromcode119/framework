import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { EdgeStopAdminController } from '@api/controllers/system/edge-stop-admin-controller';
import { EdgeStopAdminService } from '@api/services/security/edge-stop-admin-service';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/edge-stops` — the addresses the gateway stopped as scanners: the list, and per stop
 * "Release" and "Block for good". `admin` role AND platform admin on every route.
 */
export class EdgeStopAdminRouter extends BaseRouter {
  private readonly controller: EdgeStopAdminController;

  constructor(service: EdgeStopAdminService, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard) {
    super();
    this.controller = new EdgeStopAdminController(service);
  }

  protected registerRoutes(): void {
    const admin = this.auth.guard(['admin']);
    const platform = this.platformAdmin.middleware();
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, admin, platform, this.controller.list);
    this.post(S.EDGE_STOP_RELEASE, admin, platform, this.controller.release);
    this.post(S.EDGE_STOP_BLOCK, admin, platform, this.controller.block);
  }
}
