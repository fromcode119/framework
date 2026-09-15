import { BaseRouter } from '@fromcode119/core';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { ThemeManager } from '@fromcode119/core';
import { ThemeController } from '@api/controllers/themes/theme-controller';
import { ThemeAssetsListController } from '@api/controllers/themes/theme-assets-list-controller';
import { RouteConstants } from '@fromcode119/core';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

export class ThemeRouter extends BaseRouter {
  private controller: ThemeController;
  private assetsListController: ThemeAssetsListController;
  private upload: multer.Multer;
  private chunkUpload: multer.Multer;

  constructor(
    private manager: ThemeManager,
    private auth: AuthManager,
    private platformAdmin: PlatformAdminGuard,
  ) {
    super();
    this.controller = new ThemeController(manager);
    this.assetsListController = new ThemeAssetsListController(manager);
    this.upload = multer({ dest: '/tmp/theme-uploads' });
    this.chunkUpload = multer({ dest: '/tmp/theme-upload-chunks' });
  }

  protected registerRoutes(): void {
    // Two tiers (T3). Activate / disable / reset / config are SITE actions — a tenant admin chooses among
    // the installed themes for its own site, and the manager writes the tenant's row. Install, upload,
    // delete, update and the marketplace change the FILES every site renders from: platform admin only.
    const platform = this.platformAdmin.middleware();
    this.get(RouteConstants.SEGMENTS.THEMES_ACTIVE_ASSETS, this.auth.guard(['admin']), this.bind(this.assetsListController.listActiveThemeAssets));
    this.get('/', this.auth.guard(['admin']), this.controller.list);
    // A site browses its own theme catalogue. Unlike plugins, it can also ACT on what it finds:
    // `/mine/upload` installs a theme into the site's own directory, so the Install button here has
    // somewhere real to go. Installing onto the SHARED root stays platform-only below.
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), this.controller.getMarketplace);
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_CHECK_UPDATE, this.auth.guard(['admin']), platform, this.controller.checkUpdate);
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, this.auth.guard(['admin']), this.controller.activate);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, this.auth.guard(['admin']), this.controller.activate);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_DISABLE, this.auth.guard(['admin']), this.controller.disable);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_RESET, this.auth.guard(['admin']), this.controller.reset);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_INSTALL, this.auth.guard(['admin']), platform, this.controller.install);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION, this.auth.guard(['admin']), platform, this.controller.startUploadSession);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_CHUNK, this.auth.guard(['admin']), platform, this.chunkUpload.single('chunk'), this.controller.uploadChunk);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION_INSPECT, this.auth.guard(['admin']), platform, this.controller.inspectStagedUpload);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_INSPECT, this.auth.guard(['admin']), platform, this.upload.single('theme'), this.controller.inspectUpload);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_COMPLETE, this.auth.guard(['admin']), platform, this.controller.completeStagedUpload);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD, this.auth.guard(['admin']), platform, this.upload.single('theme'), this.controller.upload);
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, this.auth.guard(['admin']), this.controller.getConfig);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, this.auth.guard(['admin']), this.controller.saveConfig);
    this.delete(RouteConstants.SEGMENTS.THEMES_SLUG, this.auth.guard(['admin']), platform, this.controller.delete);

    // A SITE's OWN theme. Gated on the site's admin, NOT on a platform admin, because this writes
    // into that site's own directory and nothing else can see it — the reason the platform tier
    // exists ("these files are what every site renders from") does not apply to a package only one
    // site can reach. What stands in its place is `TenantThemePackagePolicy`: no server code, no
    // taking a slug someone else holds, and a quota on the shared disk.
    this.post(RouteConstants.SEGMENTS.THEMES_MINE_UPLOAD, this.auth.guard(['admin']), this.upload.single('theme'), this.controller.uploadMine);
    this.delete(RouteConstants.SEGMENTS.THEMES_MINE_SLUG, this.auth.guard(['admin']), this.controller.deleteMine);
  }
}