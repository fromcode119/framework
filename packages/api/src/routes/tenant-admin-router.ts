import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, PluginManager, RouteConstants, ThemeManager } from '@fromcode119/core';
import { TenantAdminController } from '@api/controllers/system/tenant-admin-controller';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { TenantAdminService } from '@api/services/tenants/tenant-admin-service';

/**
 * `/system/admin/tenants` — creating, changing, exporting, importing and deleting SITES.
 *
 * Every route: `admin` role AND platform admin. There is no tenant-level view of this surface at
 * all; a tenant's administrator manages its site through the ordinary admin, never the registry.
 */
export class TenantAdminRouter extends BaseRouter {
  private readonly controller: TenantAdminController;
  private readonly chunkUpload: multer.Multer;

  constructor(
    manager: PluginManager,
    themeManager: ThemeManager,
    uploadsDir: string,
    private readonly auth: AuthManager,
    private readonly platformAdmin: PlatformAdminGuard,
  ) {
    super();
    this.controller = new TenantAdminController(new TenantAdminService(manager, themeManager, uploadsDir));
    this.chunkUpload = multer({ dest: fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-tenant-import-chunks-')) });
  }

  protected registerRoutes(): void {
    const admin = this.auth.guard(['admin']);
    const platform = this.platformAdmin.middleware();
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, admin, platform, this.controller.list);
    this.post(S.TENANTS_ROOT, admin, platform, this.controller.create);
    // Import and adopt are registered BEFORE `/:id` so "import" and "adopt" are never read as ids.
    this.post(S.TENANTS_IMPORT_SESSION, admin, platform, this.controller.startImportSession);
    this.post(S.TENANTS_IMPORT_CHUNK, admin, platform, this.chunkUpload.single('chunk'), this.controller.uploadImportChunk);
    this.post(S.TENANTS_IMPORT_PREVIEW, admin, platform, this.controller.previewImport);
    this.post(S.TENANTS_IMPORT_EXECUTE, admin, platform, this.controller.executeImport);
    this.post(S.TENANTS_ADOPT, admin, platform, this.controller.adopt);
    this.get(S.TENANTS_ID, admin, platform, this.controller.get);
    this.patch(S.TENANTS_ID, admin, platform, this.controller.update);
    this.delete(S.TENANTS_ID, admin, platform, this.controller.deleteTenant);
    this.post(S.TENANTS_ID_EXPORT, admin, platform, this.controller.exportTenant);
    this.post(S.TENANTS_ID_PAGES, admin, platform, this.controller.materializePages);
    this.get(S.TENANTS_ID_MEMBERS_LIST, admin, platform, this.controller.listMembers);
    this.post(S.TENANTS_ID_MEMBERS, admin, platform, this.controller.addMember);
    this.delete(S.TENANTS_ID_MEMBERS_USER, admin, platform, this.controller.removeMember);
  }
}
