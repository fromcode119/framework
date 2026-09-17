import fs from 'fs';
import { ArchiveUploadSessionService, BaseController, ThemeManager, Logger } from '@fromcode119/core';
import { CoercionUtils, CoreServices } from '@fromcode119/core';
import { Request, Response } from 'express';

/**
 * Getting a theme package INTO the platform: a direct upload, a chunked one, and taking it away again.
 *
 * Chunked upload exists because a theme with its bundled plugins is routinely larger than a proxy
 * will pass in one request. A session stages the parts, and the package is only inspected once it is
 * whole — inspecting a partial archive tells you nothing except that it is partial.
 *
 * A refusal maps to a STATUS here rather than defaulting to 500: a theme rejected for what it
 * contains is the operator's problem to fix and must not read as the server failing.
 *
 * Split out of `ThemeController` (337 lines), which installs and activates what this accepts.
 */
export class ThemeUploadController {
  static readonly ALLOWED_ARCHIVE_EXTENSIONS = ['.zip', '.tar.gz', '.tgz'];

  constructor(
    private readonly manager: ThemeManager,
    private readonly logger: any,
    private readonly archiveSupport: any,
  ) {}

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
      const manifest = await this.manager.installFromZip(req.file.path);
      res.json({ success: true, manifest });
    } catch (err: any) {
      this.logger.error(`Failed to upload theme: ${err.message}`);
      res.status(500).json({ error: err.message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  /**
   * A SITE uploading its OWN theme.
   *
   * Separate from {@link upload}, which installs onto the shared container for every site. The
   * refusals live in the installer, and each of them is a 4xx the operator can act on rather than a
   * 500: "your package contains server code", "that slug is taken", "you are over your quota" are all
   * things the person uploading can fix, and reporting them as server errors would say the opposite.
   */
  async uploadMine(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'no_file', message: 'Choose a .zip or .tar.gz theme package to upload.' });

    const tenantId = String((req as any).tenantId || '').trim();
    if (!tenantId) {
      return res.status(400).json({
        error: 'site_required',
        message: 'A theme belongs to one site. Choose a site first — with none selected there is nowhere to put it.',
      });
    }

    try {
      const manifest = await this.manager.installForTenant(req.file.path, tenantId);
      res.json({ success: true, manifest, serverRendering: false });
    } catch (err: any) {
      const message = String(err?.message || 'The theme could not be installed.');
      this.logger.warn(`Site "${tenantId}" could not upload a theme: ${message}`);
      res.status(ThemeUploadController.refusalStatus(message)).json({ error: 'theme_rejected', message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  /** A SITE removing one of its OWN themes. The manager refuses anything it does not own. */
  async deleteMine(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    const tenantId = String((req as any).tenantId || '').trim();
    if (!tenantId) {
      return res.status(400).json({ error: 'site_required', message: 'Choose a site first.' });
    }

    try {
      await this.manager.removeTenantTheme(slug, tenantId);
      res.json({ success: true });
    } catch (err: any) {
      const message = String(err?.message || 'The theme could not be removed.');
      res.status(ThemeUploadController.refusalStatus(message)).json({ error: 'theme_not_removed', message });
    }
  }

  /**
   * Which 4xx a refusal is, read from what the installer actually refused.
   *
   * A taken slug is a CONFLICT and nothing the uploader can retry their way out of; everything else
   * here is a malformed or oversized package, which is a bad request. Both are the caller's to fix,
   * so neither is a 500 — a server error would tell an operator to look at logs that say nothing is
   * wrong.
   */
  private static refusalStatus(message: string): number {
    if (/already taken/i.test(message)) return 409;
    if (/does not belong to this site|not installed/i.test(message)) return 404;
    return 400;
  }

  async inspectUpload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
      const info = await this.archiveSupport.inspectThemeArchive(req.file.path, req.file.originalname);
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid theme archive' });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async startUploadSession(req: Request, res: Response) {
    try {
      const payload = this.archiveSupport.readUploadSessionRequest(req.body);
      res.status(201).json({
        success: true,
        ...ArchiveUploadSessionService.startSession(
          payload.originalFilename,
          payload.totalSizeBytes,
          payload.totalChunks,
          ThemeUploadController.ALLOWED_ARCHIVE_EXTENSIONS,
        ),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Could not start upload session.' });
    }
  }

  async uploadChunk(req: any, res: Response) {
    try {
      const payload = this.archiveSupport.readChunkUploadRequest(req);
      const result = ArchiveUploadSessionService.appendChunk(payload.uploadId, payload.filePath, payload.chunkIndex, payload.totalChunks);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Could not upload theme package chunk.' });
    }
  }

  async inspectStagedUpload(req: Request, res: Response) {
    try {
      const uploadId = this.archiveSupport.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const info = await this.archiveSupport.inspectThemeArchive(uploadedArchive.filePath, uploadedArchive.originalFilename);
      res.json({ success: true, uploadId, info });
    } catch (err: any) {
      res.status(err?.statusCode || 400).json({ error: err.message || 'Invalid theme archive' });
    }
  }

  async completeStagedUpload(req: Request, res: Response) {
    let uploadId = '';
    try {
      uploadId = this.archiveSupport.readUploadId(req.body);
      const uploadedArchive = ArchiveUploadSessionService.resolveUploadedArchive(uploadId);
      const manifest = await this.manager.installFromZip(uploadedArchive.filePath);
      res.json({ success: true, manifest });
    } catch (err: any) {
      this.logger.error(`Failed to upload theme: ${err.message}`);
      res.status(err?.statusCode || 500).json({ error: err.message || 'Could not install theme package.' });
    } finally {
      if (uploadId) {
        ArchiveUploadSessionService.discardSession(uploadId);
      }
    }
  }
}
