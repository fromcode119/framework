import { BaseRouter } from '../routers/base-router';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { ThemeManager } from '@fromcode119/core';
import { ThemeController } from '../controllers/theme-controller';
import { RouteConstants } from '@fromcode119/core';

export class ThemeRouter extends BaseRouter {
  private controller: ThemeController;
  private upload: multer.Multer;

  constructor(
    private manager: ThemeManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new ThemeController(manager);
    this.upload = multer({ dest: '/tmp/theme-uploads' });
  }

  protected registerRoutes(): void {
    // Theme listing and management
    this.get('/', this.auth.guard(['admin']), this.bind(this.controller.list.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), this.bind(this.controller.getMarketplace.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_CHECK_UPDATE, this.auth.guard(['admin']), this.bind(this.controller.checkUpdate.bind(this.controller)));
    
    // Theme activation and reset
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, this.auth.guard(['admin']), this.bind(this.controller.activate.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, this.auth.guard(['admin']), this.bind(this.controller.activate.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_RESET, this.auth.guard(['admin']), this.bind(this.controller.reset.bind(this.controller)));
    
    // Installation
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_INSTALL, this.auth.guard(['admin']), this.bind(this.controller.install.bind(this.controller)));
    
    // Upload and inspect
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT, this.auth.guard(['admin']), this.upload.single('theme'), 
      this.bind(this.controller.inspectUpload.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD, this.auth.guard(['admin']), this.upload.single('theme'), 
      this.bind(this.controller.upload.bind(this.controller)));
    
    // Configuration
    this.get(RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, this.auth.guard(['admin']), this.bind(this.controller.getConfig.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, this.auth.guard(['admin']), this.bind(this.controller.saveConfig.bind(this.controller)));
    
    // Theme deletion
    this.delete(RouteConstants.SEGMENTS.THEMES_SLUG, this.auth.guard(['admin']), this.bind(this.controller.delete.bind(this.controller)));
  }
}