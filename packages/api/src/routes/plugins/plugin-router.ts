import { BaseRouter } from '@fromcode119/core';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginController } from '@api/controllers/plugins/plugin-controller';
import { RouteConstants } from '@fromcode119/core';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

export class PluginRouter extends BaseRouter {
  private controller: PluginController;
  private upload: multer.Multer;
  private chunkUpload: multer.Multer;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager,
    private platformAdmin: PlatformAdminGuard,
  ) {
    super();
    this.controller = new PluginController(manager);
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-plugin-uploads-'));
    const chunkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-plugin-upload-chunks-'));
    this.upload = multer({ dest: uploadsDir });
    this.chunkUpload = multer({ dest: chunkDir });
  }

  protected registerRoutes(): void {
    // Two tiers. `admin` alone lists what THIS site runs (the controller filters). Everything
    // that touches the shared container — install, update, delete, sandbox, platform config, the
    // marketplace — additionally needs a PLATFORM admin, or one customer could put code on the box
    // every other customer runs on. Single-tenant deployments pass every admin through.
    const platform = this.platformAdmin.middleware();
    this.get('/', this.auth.guard(['admin']), this.controller.list);
    this.get(RouteConstants.SEGMENTS.ACTIVE, this.controller.active);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_TOGGLE, this.auth.guard(['admin']), platform, this.controller.toggle);
    this.post(RouteConstants.SEGMENTS.PLUGINS_REAPPROVE_ALL, this.auth.guard(['admin']), platform, this.controller.reapproveAll);
    this.get(RouteConstants.SEGMENTS.PLUGINS_HEALTH, this.auth.guard(['admin']), platform, this.controller.health);
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), platform, this.controller.getConfig);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), platform, this.controller.saveConfig);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SANDBOX, this.auth.guard(['admin']), platform, this.controller.saveSandboxConfig);
    this.delete(RouteConstants.SEGMENTS.PLUGINS_SLUG, this.auth.guard(['admin']), platform, this.controller.delete);
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), platform, this.controller.marketplace);
    this.post(RouteConstants.SEGMENTS.PLUGINS_INSTALL, this.auth.guard(['admin']), platform, this.controller.install);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPDATE_ALL, this.auth.guard(['admin']), platform, (req: any, res: any) => this.controller.updateAll(req, res));
    this.get(RouteConstants.SEGMENTS.PLUGINS_INSTALL_OPERATION, this.auth.guard(['admin']), platform, this.controller.installOperation);
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, this.auth.guard(['admin']), platform, this.controller.logs);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION, this.auth.guard(['admin']), platform, this.controller.startUploadSession);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_CHUNK, this.auth.guard(['admin']), platform, this.chunkUpload.single('chunk'), this.controller.uploadChunk);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION_INSPECT, this.auth.guard(['admin']), platform, this.controller.inspectStagedUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT, this.auth.guard(['admin']), platform, this.upload.single('plugin'), this.controller.inspectUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_COMPLETE, this.auth.guard(['admin']), platform, this.controller.completeStagedUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD, this.auth.guard(['admin']), platform, this.upload.single('plugin'), this.controller.upload);
  }
}