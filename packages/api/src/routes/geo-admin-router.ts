import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, GeoDatabaseUpdater, RouteConstants } from '@fromcode119/core';
import { GeoAdminController } from '@api/controllers/system/geo-admin-controller';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/geo` — the platform's IP-location database. `admin` role AND platform admin: one
 * database serves every site on the server, so no site's administrator may switch or refresh it.
 */
export class GeoAdminRouter extends BaseRouter {
  private readonly controller: GeoAdminController;

  constructor(
    updater: GeoDatabaseUpdater,
    private readonly auth: AuthManager,
    private readonly platformAdmin: PlatformAdminGuard,
  ) {
    super();
    this.controller = new GeoAdminController(updater);
  }

  protected registerRoutes(): void {
    const admin = this.auth.guard(['admin']);
    const platform = this.platformAdmin.middleware();
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, admin, platform, this.controller.status);
    this.post(S.GEO_UPDATE, admin, platform, this.controller.update);
  }
}
