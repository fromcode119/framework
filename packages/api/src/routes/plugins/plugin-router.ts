import { BaseRouter } from '../../routers/base-router';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginController } from '../../controllers/plugins/plugin-controller';
import { RouteConstants } from '@fromcode119/core';

export class PluginRouter extends BaseRouter {
  private controller: PluginController;
  private upload: multer.Multer;
  private chunkUpload: multer.Multer;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new PluginController(manager);
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-plugin-uploads-'));
    const chunkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-plugin-upload-chunks-'));
    this.upload = multer({ dest: uploadsDir });
    this.chunkUpload = multer({ dest: chunkDir });
  }

  protected registerRoutes(): void {
    this.get('/', this.auth.guard(['admin']), this.controller.list);
    this.get(RouteConstants.SEGMENTS.ACTIVE, this.controller.active);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_TOGGLE, this.auth.guard(['admin']), this.controller.toggle);
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), this.controller.getConfig);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), this.controller.saveConfig);
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SANDBOX, this.auth.guard(['admin']), this.controller.saveSandboxConfig);
    this.delete(RouteConstants.SEGMENTS.PLUGINS_SLUG, this.auth.guard(['admin']), this.controller.delete);
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), this.controller.marketplace);
    this.post(RouteConstants.SEGMENTS.PLUGINS_INSTALL, this.auth.guard(['admin']), this.controller.install);
    this.get(RouteConstants.SEGMENTS.PLUGINS_INSTALL_OPERATION, this.auth.guard(['admin']), this.controller.installOperation);
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, this.auth.guard(['admin']), this.controller.logs);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION, this.auth.guard(['admin']), this.controller.startUploadSession);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_CHUNK, this.auth.guard(['admin']), this.chunkUpload.single('chunk'), this.controller.uploadChunk);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION_INSPECT, this.auth.guard(['admin']), this.controller.inspectStagedUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT, this.auth.guard(['admin']), this.upload.single('plugin'), this.controller.inspectUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_COMPLETE, this.auth.guard(['admin']), this.controller.completeStagedUpload);
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD, this.auth.guard(['admin']), this.upload.single('plugin'), this.controller.upload);
  }
}