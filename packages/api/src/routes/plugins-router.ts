import { BaseRouter } from '../routers/base-router';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginController } from '../controllers/plugin-controller';
import { RouteConstants } from '@fromcode119/core';

export class PluginsRouter extends BaseRouter {
  private controller: PluginController;
  private upload: ReturnType<typeof multer>;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new PluginController(manager);
    this.upload = multer({ dest: '/tmp/plugin-uploads' });
  }

  protected registerRoutes(): void {
    const isAdmin = this.auth.guard(['admin']);

    this.get('/', isAdmin, this.bind(this.controller.list.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ACTIVE, this.bind(this.controller.active.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, isAdmin, this.bind(this.controller.marketplace.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_INSTALL, isAdmin, this.bind(this.controller.install.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT, isAdmin, this.upload.single('plugin'), (req, res) => this.controller.inspectUpload(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD, isAdmin, this.upload.single('plugin'), (req, res) => this.controller.upload(req, res));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_TOGGLE, isAdmin, this.bind(this.controller.toggle.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, isAdmin, this.bind(this.controller.getConfig.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, isAdmin, this.bind(this.controller.saveConfig.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SANDBOX, isAdmin, this.bind(this.controller.saveSandboxConfig.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.PLUGINS_SLUG, isAdmin, this.bind(this.controller.delete.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, isAdmin, this.bind(this.controller.logs.bind(this.controller)));
  }
}