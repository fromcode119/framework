import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { EdgeAdminController } from '@api/controllers/system/edge-admin-controller';
import { EdgeAdminService } from '@api/services/security/edge-admin-service';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/edges` — the edges added to the platform: the list, "Add edge", a new token, "Remove".
 * `admin` role AND platform admin on every route.
 */
export class EdgeAdminRouter extends BaseRouter {
  private readonly controller: EdgeAdminController;

  constructor(service: EdgeAdminService, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard) {
    super();
    this.controller = new EdgeAdminController(service);
  }

  protected registerRoutes(): void {
    const admin = this.auth.guard(['admin']);
    const platform = this.platformAdmin.middleware();
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, admin, platform, this.controller.list);
    this.post(S.TENANTS_ROOT, admin, platform, this.controller.add);
    this.post(S.EDGE_TOKEN, admin, platform, this.controller.token);
    this.post(S.EDGE_REVOKE, admin, platform, this.controller.revoke);
  }
}
