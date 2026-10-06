import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { SchemaOrphanAdminController } from '@api/controllers/system/schema-orphan-admin-controller';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/schema-orphans` — the database-schema review. `admin` role AND platform admin: one
 * schema serves every site, so no site's administrator can see or change it.
 */
export class SchemaOrphanAdminRouter extends BaseRouter {
  private readonly controller: SchemaOrphanAdminController;

  constructor(manager: any, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard) {
    super();
    this.controller = new SchemaOrphanAdminController(manager);
  }

  protected registerRoutes(): void {
    const admin = this.auth.guard(['admin']);
    const platform = this.platformAdmin.middleware();
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, admin, platform, this.controller.list);
    this.post(S.SCHEMA_ORPHANS_DROP, admin, platform, this.controller.drop);
  }
}
