import { BaseRouter } from '../../routers/base-router';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { ThemeManager } from '@fromcode119/core';
import { ThemeController } from '../../controllers/themes/theme-controller';
import { ThemeAssetsListController } from '../../controllers/themes/theme-assets-list-controller';
import { RouteConstants } from '@fromcode119/core';

export class ThemeRouter extends BaseRouter {
  private controller: ThemeController;
  private assetsListController: ThemeAssetsListController;
  private upload: multer.Multer;
  private chunkUpload: multer.Multer;

  constructor(
    private manager: ThemeManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new ThemeController(manager);
    this.assetsListController = new ThemeAssetsListController(manager);
    this.upload = multer({ dest: '/tmp/theme-uploads' });
    this.chunkUpload = multer({ dest: '/tmp/theme-upload-chunks' });
  }

  protected registerRoutes(): void {
    this.get(RouteConstants.SEGMENTS.THEMES_ACTIVE_ASSETS, this.auth.guard(['admin']), this.bind(this.assetsListController.listActiveThemeAssets));
    this.get('/', this.auth.guard(['admin']), this.controller.list);
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), this.controller.getMarketplace);
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_CHECK_UPDATE, this.auth.guard(['admin']), this.controller.checkUpdate);
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, this.auth.guard(['admin']), this.controller.activate);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, this.auth.guard(['admin']), this.controller.activate);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_DISABLE, this.auth.guard(['admin']), this.controller.disable);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_RESET, this.auth.guard(['admin']), this.controller.reset);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_INSTALL, this.auth.guard(['admin']), this.controller.install);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION, this.auth.guard(['admin']), this.controller.startUploadSession);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_CHUNK, this.auth.guard(['admin']), this.chunkUpload.single('chunk'), this.controller.uploadChunk);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION_INSPECT, this.auth.guard(['admin']), this.controller.inspectStagedUpload);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_INSPECT, this.auth.guard(['admin']), this.upload.single('theme'), this.controller.inspectUpload);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD_COMPLETE, this.auth.guard(['admin']), this.controller.completeStagedUpload);
    this.post(RouteConstants.SEGMENTS.THEMES_UPLOAD, this.auth.guard(['admin']), this.upload.single('theme'), this.controller.upload);
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, this.auth.guard(['admin']), this.controller.getConfig);
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, this.auth.guard(['admin']), this.controller.saveConfig);
    this.delete(RouteConstants.SEGMENTS.THEMES_SLUG, this.auth.guard(['admin']), this.controller.delete);
  }
}