import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { MonitoringAdminController } from '@api/controllers/system/monitoring-admin-controller';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/monitoring` — the platform monitor's Health page. `admin` role AND platform admin: it
 * watches every site on the server, so no site's administrator sees or runs it.
 */
export class MonitoringAdminRouter extends BaseRouter {
  private readonly controller: MonitoringAdminController;

  constructor(manager: any, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard) {
    super();
    this.controller = new MonitoringAdminController(manager);
  }

  protected registerRoutes(): void {
    const admin = this.auth.guard(['admin']);
    const platform = this.platformAdmin.middleware();
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, admin, platform, this.controller.status);
    this.post(S.MONITORING_CHECK, admin, platform, this.controller.check);
  }
}
