import { BaseRouter } from '@fromcode119/core';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginController } from '@api/controllers/plugins/plugin-controller';
import { PluginUploadController } from '@api/controllers/plugins/plugin-upload-controller';
import { PluginLifecycleController } from '@api/controllers/plugins/plugin-lifecycle-controller';
import { RouteConstants } from '@fromcode119/core';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { PluginRuntimeController } from '@api/controllers/plugins/plugin-runtime-controller';

export class PluginRouter extends BaseRouter {
  private controller: PluginController;
  private uploadController: PluginUploadController;
  private lifecycleController: PluginLifecycleController;
  private runtimeController: PluginRuntimeController;
  private upload: multer.Multer;
  private chunkUpload: multer.Multer;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager,
    private platformAdmin: PlatformAdminGuard,
  ) {
    super();
    this.controller = new PluginController(manager);
    this.uploadController = new PluginUploadController(manager);
    this.lifecycleController = new PluginLifecycleController(manager);
    this.runtimeController = new PluginRuntimeController(manager);
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
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_TOGGLE, this.auth.guard(['admin']), platform, this.lifecycleController.toggle);
    this.post(RouteConstants.SEGMENTS.PLUGINS_REAPPROVE_ALL, this.auth.guard(['admin']), platform, this.lifecycleController.reapproveAll);
    // Health is a SITE screen: a site on this platform behaves like its own installation, so it can
    // see whether the plugins IT runs are healthy. The controller filters the report to the bound
    // site's assignment, which is what makes this safe to open — without that filter it would hand
    // one customer every other customer's slugs, held reasons and load errors. In PLATFORM scope it
    // still reports the whole registry, which is the operator's view.
    this.get(RouteConstants.SEGMENTS.PLUGINS_HEALTH, this.auth.guard(['admin']), this.controller.health);
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), platform, this.controller.getConfig);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), platform, this.controller.saveConfig);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SANDBOX, this.auth.guard(['admin']), platform, this.controller.saveSandboxConfig);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_LOAD_INSTALLED, this.auth.guard(['admin']), platform, this.lifecycleController.loadInstalled);
    this.delete(RouteConstants.SEGMENTS.PLUGINS_SLUG, this.auth.guard(['admin']), platform, this.lifecycleController.delete);
    // Browsing a catalogue is a SITE action; INSTALLING from it is not, and the two are separated
    // deliberately. A site may look — it has a marketplace of its own, and may point it at its own
    // catalogue (its own `marketplace_url` row) — while `PLUGINS_INSTALL` below stays platform-only, because
    // installing a plugin puts code on the container every customer shares. Per-site plugin install
    // is not merely ungated work: it cannot be safe until the privileged spawner is on the box, since
    // the default launcher does not isolate identity.
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), this.controller.marketplace);
    this.post(RouteConstants.SEGMENTS.PLUGINS_INSTALL, this.auth.guard(['admin']), platform, this.controller.install);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPDATE_ALL, this.auth.guard(['admin']), platform, (req: any, res: any) => this.controller.updateAll(req, res));
    this.get(RouteConstants.SEGMENTS.PLUGINS_INSTALL_OPERATION, this.auth.guard(['admin']), platform, this.controller.installOperation);
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, this.auth.guard(['admin']), platform, this.controller.logs);
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_RUNTIME, this.auth.guard(['admin']), platform, this.runtimeController.runtime);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION, this.auth.guard(['admin']), platform, this.uploadController.startUploadSession);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_CHUNK, this.auth.guard(['admin']), platform, this.chunkUpload.single('chunk'), this.uploadController.uploadChunk);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION_INSPECT, this.auth.guard(['admin']), platform, this.uploadController.inspectStagedUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT, this.auth.guard(['admin']), platform, this.upload.single('plugin'), this.uploadController.inspectUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_COMPLETE, this.auth.guard(['admin']), platform, this.uploadController.completeStagedUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD, this.auth.guard(['admin']), platform, this.upload.single('plugin'), this.uploadController.upload);
  }
}