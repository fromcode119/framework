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
    this.get('/', this.auth.guard(['admin']), this.bind(this.controller.list.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ACTIVE, this.bind(this.controller.active.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_TOGGLE, this.auth.guard(['admin']), this.bind(this.controller.toggle.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), this.bind(this.controller.getConfig.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_CONFIG, this.auth.guard(['admin']), this.bind(this.controller.saveConfig.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_SLUG_SANDBOX, this.auth.guard(['admin']), this.bind(this.controller.saveSandboxConfig.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.PLUGINS_SLUG, this.auth.guard(['admin']), this.bind(this.controller.delete.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_MARKETPLACE, this.auth.guard(['admin']), this.bind(this.controller.marketplace.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_INSTALL, this.auth.guard(['admin']), this.bind(this.controller.install.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_INSTALL_OPERATION, this.auth.guard(['admin']), this.bind(this.controller.installOperation.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, this.auth.guard(['admin']), this.bind(this.controller.logs.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION, this.auth.guard(['admin']), this.bind(this.controller.startUploadSession.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_CHUNK, this.auth.guard(['admin']), this.chunkUpload.single('chunk'), this.bind(this.controller.uploadChunk.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION_INSPECT, this.auth.guard(['admin']), this.bind(this.controller.inspectStagedUpload.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT, this.auth.guard(['admin']), this.upload.single('plugin'), this.bind(this.controller.inspectUpload.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD_COMPLETE, this.auth.guard(['admin']), this.bind(this.controller.completeStagedUpload.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.PLUGINS_UPLOAD, this.auth.guard(['admin']), this.upload.single('plugin'), this.bind(this.controller.upload.bind(this.controller)));
  }
}