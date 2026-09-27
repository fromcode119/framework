import fs from 'fs';
import multer from 'multer';
import type { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger, PluginManager, PluginTenantStateService, TenantPluginQuota, TenantPluginRefusal, TenantPluginRefusalReason } from '@fromcode119/core';

/**
 * A SITE uploading and removing plugins of its own.
 *
 * Not the platform's upload (`PluginUploadController`), which installs onto the shared container for
 * every site. Everything that decides what a site may do lives in `TenantPluginInstaller`; this only
 * turns its refusals into the status an operator can act on. A refusal is never a 500: "uploads are
 * off", "your package asks for the network", "that name is taken" are all the uploader's to fix.
 */
export class SitePluginUploadController extends BaseController {
  private readonly logger = new Logger({ namespace: 'site-plugin-upload' });

  constructor(private readonly manager: PluginManager) {
    super();
  }

  /**
   * Receives the upload, cut off at what the site may store: a larger file is refused while it streams
   * rather than written to the shared disk first and measured afterwards.
   */
  static receiver(uploadsDir: string) {
    return async (req: any, res: Response, next: (err?: unknown) => void) => {
      const { maxBytes } = await TenantPluginQuota.current();
      multer({ dest: uploadsDir, limits: { fileSize: maxBytes, files: 1 } }).single('plugin')(req, res, (err: any) => {
        if (!err) return next();
        const tooLarge = err?.code === 'LIMIT_FILE_SIZE';
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge ? TenantPluginRefusalReason.QUOTA.value : TenantPluginRefusalReason.INVALID.value,
          message: tooLarge ? `The package is larger than the ${(maxBytes / (1024 * 1024)).toFixed(1)} MB a site may store.` : String(err?.message || 'The upload failed.'),
        });
      });
    };
  }

  async quota(req: Request, res: Response) {
    const tenantId = SitePluginUploadController.tenantOf(req);
    if (!tenantId) return SitePluginUploadController.siteRequired(res);
    res.json(await this.manager.tenantPlugins.quota(tenantId));
  }

  async upload(req: any, res: Response) {
    const tenantId = SitePluginUploadController.tenantOf(req);
    try {
      if (!tenantId) return SitePluginUploadController.siteRequired(res);
      if (!req.file) return res.status(400).json({ error: 'no_file', message: 'Choose a .zip plugin package to upload.' });
      const manifest = await this.manager.tenantPlugins.install(tenantId, req.file.path);
      res.json({ success: true, slug: manifest.slug, name: manifest.name, version: manifest.version });
    } catch (err: any) {
      this.refuse(res, err, tenantId, 'upload a plugin');
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async remove(req: Request, res: Response) {
    const tenantId = SitePluginUploadController.tenantOf(req);
    if (!tenantId) return SitePluginUploadController.siteRequired(res);
    try {
      const slug = CoercionUtils.toString(req.params.slug);
      await this.manager.tenantPlugins.remove(tenantId, slug);
      await new PluginTenantStateService((this.manager as any).schemaDb ?? this.manager.db).forget(tenantId, slug);
      res.json({ success: true });
    } catch (err: any) {
      this.refuse(res, err, tenantId, 'remove a plugin');
    }
  }

  private refuse(res: Response, err: any, tenantId: string, action: string): void {
    if (!(err instanceof TenantPluginRefusal)) {
      this.logger.error(`Site "${tenantId}" could not ${action}: ${err?.message || err}`);
      res.status(500).json({ error: 'site_plugin_failed', message: String(err?.message || `Could not ${action}.`) });
      return;
    }
    this.logger.warn(`Site "${tenantId}" could not ${action}: ${err.message}`);
    res.status(SitePluginUploadController.statusOf(err.reason)).json({ error: err.reason.value, message: err.message });
  }

  private static statusOf(reason: TenantPluginRefusalReason): number {
    if (reason === TenantPluginRefusalReason.DISABLED || reason === TenantPluginRefusalReason.ISOLATION_UNAVAILABLE) return 403;
    if (reason === TenantPluginRefusalReason.SLUG_TAKEN) return 409;
    if (reason === TenantPluginRefusalReason.NOT_FOUND) return 404;
    if (reason === TenantPluginRefusalReason.QUOTA) return 413;
    return 400;
  }

  private static tenantOf(req: Request): string {
    return String((req as any).tenantId || '').trim();
  }

  private static siteRequired(res: Response) {
    return res.status(400).json({ error: 'site_required', message: 'A site\'s plugin belongs to one site. Choose a site first.' });
  }
}
