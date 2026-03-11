import { BaseRouter } from '../routers/base-router';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginController } from '../controllers/plugin-controller';
import { RouteConstants } from '@fromcode119/core';

export class PluginRouter extends BaseRouter {
  private controller: PluginController;
  private upload: multer.Multer;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new PluginController(manager);
    this.upload = multer({ dest: '/tmp/plugin-uploads' });
  }

  protected registerRoutes(): void {
    // Plugin listing and toggle
    this.get('/', this.auth.guard(['admin']), this.bind(this.controller.list.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ACTIVE, this.bind(this.controller.active.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_TOGGLE, this.auth.guard(['admin']), this.bind(this.controller.toggle.bind(this.controller)));
    
    // Configuration management
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), this.bind(this.controller.getConfig.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), this.bind(this.controller.saveConfig.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SANDBOX, this.auth.guard(['admin']), this.bind(this.controller.saveSandboxConfig.bind(this.controller)));
    
    // Plugin deletion
    this.delete(RouteConstants.SEGMENTS.PLUGINS_SLUG, this.auth.guard(['admin']), this.bind(this.controller.delete.bind(this.controller)));
    
    // Marketplace and installation
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), this.bind(this.controller.marketplace.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_INSTALL, this.auth.guard(['admin']), this.bind(this.controller.install.bind(this.controller)));
    
    // Logging
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, this.auth.guard(['admin']), this.bind(this.controller.logs.bind(this.controller)));
    
    // Upload and inspect
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT, this.auth.guard(['admin']), this.upload.single('plugin'), 
      this.bind(this.controller.inspectUpload.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD, this.auth.guard(['admin']), this.upload.single('plugin'), 
      this.bind(this.controller.upload.bind(this.controller)));
  }
}