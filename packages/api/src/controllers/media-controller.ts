import { Request, Response } from 'express';
import { BaseController, PluginManager, Logger, MediaVisibility, SystemConstants } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { IDatabaseManager, Schema } from '@fromcode119/database';
import { ApiUrlUtils } from '@api/utils/url';
import { MediaFolderController } from '@api/controllers/media-folder-controller';
import { MediaVisibilityTransferService } from '@api/services/media-visibility-transfer-service';
import { MediaLibraryController } from '@api/controllers/media-library-controller';

export class MediaController extends BaseController {
  private db: IDatabaseManager;
  private logger = new Logger({ namespace: 'media-controller' });
  private folders: MediaFolderController;

  private readonly transfers: MediaVisibilityTransferService;
  private readonly library: MediaLibraryController;

  constructor(private manager: PluginManager, private mediaManager: MediaManager) {
    super();
    this.db = (manager as any).db;
    this.folders = new MediaFolderController(this.db);
    this.transfers = new MediaVisibilityTransferService(mediaManager);
    this.library = new MediaLibraryController(
      this.db,
      this.logger,
      manager,
      mediaManager,
      (origin, filePath, visibility) => this.publicUrlFor(origin, filePath, visibility),
    );
  }

  /**
   * Works out what changing a file's visibility requires, and copies the bytes into the target space.
   *
   * Returns the column patch plus where the file USED to live, so the caller can delete the original
   * only after the row has been updated. Nothing is deleted here — a failure at this point must leave
   * the file exactly as it was.
   */
  private async planVisibilityChange(
    mediaId: number,
    target: MediaVisibility,
  ): Promise<{ patch: Record<string, any>; original: { path: string; space: MediaVisibility } | null; error?: string; status: number }> {
    const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: mediaId });
    if (!row) return { patch: {}, original: null, error: 'Media not found', status: 404 };

    const current = MediaVisibility.resolve(row.visibility ?? row.visibility);
    if (current === target) return { patch: {}, original: null, status: 200 };

    // `has(space)` rather than a `supportsPrivate` flag: spaces are an open set, so asking whether the
    // one we need exists scales to a third without another boolean.
    if (!this.mediaManager.has(target.value)) {
      // Refused rather than recorded: marking a file private while it stays in the public tree is the
      // exact lie this feature exists to prevent.
      return { patch: {}, original: null, error: 'Private storage is not configured on this install', status: 400 };
    }

    const currentPath = String(row.path || '');
    const filename = String(row.original_name || row.originalName || row.filename || 'file');
    const newPath = await this.transfers.copyToSpace(currentPath, current, target, filename);

    return {
      patch: { visibility: target.value, path: newPath, filename: newPath },
      original: { path: currentPath, space: current },
      status: 200,
    };
  }

  /**
   * A private file has NO public URL, so `null` is the honest answer — not a path that would 404.
   * `MediaManager.publicUrl` returns `''` for one; this maps that to null at the API boundary so a
   * client cannot mistake an empty string for a relative URL.
   */
  private publicUrlFor(origin: string, filePath: string, visibility: MediaVisibility): string | null {
    // The visibility value IS the storage-space name — that correspondence is deliberate, so there is
    // no mapping table to drift. `origin` is the SITE's (ApiUrlUtils.resolveSitePublicOrigin), because
    // the file lives in that site's directory and only its host serves it.
    const url = this.mediaManager.publicUrl(filePath, visibility.value);
    return url ? ApiUrlUtils.sitePublicUrl(origin, url) : null;
  }

  /** @see MediaLibraryController.upload */
  upload(...args: Parameters<MediaLibraryController["upload"]>): ReturnType<MediaLibraryController["upload"]> {
    return this.library.upload(...args);
  }

  /** @see MediaLibraryController.listFiles */
  listFiles(...args: Parameters<MediaLibraryController["listFiles"]>): ReturnType<MediaLibraryController["listFiles"]> {
    return this.library.listFiles(...args);
  }

  async listFolders(req: Request, res: Response) {
    return this.folders.listFolders(req, res);
  }

  async createFolder(req: Request, res: Response) {
    return this.folders.createFolder(req, res);
  }

  async updateFolder(req: Request, res: Response) {
    return this.folders.updateFolder(req, res);
  }

  async updateFile(req: Request, res: Response) {
    const { id } = req.params;
    const { folderId, alt, caption, visibility } = req.body ?? {};
    const patch: Record<string, any> = {};
    if (folderId !== undefined) patch.folderId = folderId === 'null' || folderId === null ? null : Number(folderId);
    if (alt !== undefined) patch.alt = alt === null || alt === '' ? null : String(alt);
    if (caption !== undefined) patch.caption = caption === null || caption === '' ? null : String(caption);
    if (Object.keys(patch).length === 0 && visibility === undefined) {
      return res.status(400).json({ error: 'No supported fields to update' });
    }
    try {
      // Visibility is not a plain column write: the bytes have to move to the matching storage space,
      // or the row starts lying about where the file is and whether it is reachable by URL.
      //
      // The original location is carried in a LOCAL, never on `this` — one controller instance serves
      // every request, so per-request state on the object would let two concurrent updates delete each
      // other's files.
      let original: { path: string; space: MediaVisibility } | null = null;

      if (visibility !== undefined) {
        const move = await this.planVisibilityChange(Number(id), MediaVisibility.resolve(visibility));
        if (move.error) return res.status(move.status).json({ error: move.error });
        Object.assign(patch, move.patch);
        original = move.original;
      }

      const updated = await this.db.update(Schema.media, { id: Number(id) }, patch);

      if (original && updated) {
        // The row now points at the new copy, so the original is safe to drop.
        await this.transfers.removeFromSpace(original.path, original.space);
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getFolderPath(req: Request, res: Response) {
    return this.folders.getFolderPath(req, res);
  }

  async deleteFolder(req: Request, res: Response) {
    return this.folders.deleteFolder(req, res);
  }

  async deleteFile(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const file: any = await this.db.findOne(Schema.media, { id: Number(id) });
      if (!file) return res.status(404).json({ error: 'File not found' });

      await this.mediaManager.remove(file.path);
      if (file.optimizedPath) {
        try { await this.mediaManager.remove(file.optimizedPath); } catch { /* ignore if missing */ }
      }
      await this.db.delete(Schema.media, { id: Number(id) });
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Streams a media file's bytes to a signed-in admin, whatever space it lives in.
   *
   * Private files have no public URL by design, which left the operator unable to see the very files
   * they uploaded — the library and the Shared list both drew a lock where the artwork should be, and a
   * file you cannot recognise is one you cannot manage. "Private" means not public; it never meant
   * hidden from the person who owns the library.
   *
   * This is NOT the share route. There is no token here and none is accepted: the only key is the
   * admin session the route guard already checked, so this can never become a link that leaks.
   */
  async streamRaw(req: Request, res: Response) {
    const row = await this.db.findOne(SystemConstants.TABLE.MEDIA, { id: Number(req.params.id) });
    if (!row) return res.status(404).json({ error: 'Media not found' });

    const visibility = MediaVisibility.resolve(row.visibility);
    try {
      const stream = await this.mediaManager.stream(String(row.path || ''), visibility.value);
      res.setHeader('Content-Type', String(row.mime_type || row.mimeType || 'application/octet-stream'));
      // Private bytes must never sit in a shared proxy, and the browser copy dies with the session.
      res.setHeader('Cache-Control', 'no-store, private');
      stream.on('error', (error: any) => {
        this.logger.error(`Raw stream failed for media ${row.id}: ${error?.message}`);
        res.destroy();
      });
      return stream.pipe(res);
    } catch (error: any) {
      this.logger.error(`Could not open media ${row.id}: ${error?.message}`);
      return res.status(404).json({ error: 'Media not found' });
    }
  }

  async optimizeImage(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const file: any = await this.db.findOne(Schema.media, { id: Number(id) });
      if (!file) return res.status(404).json({ error: 'File not found' });

      const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!supportedTypes.includes(file.mimeType)) {
        return res.status(400).json({ error: 'Only JPEG and PNG images can be optimized to WebP' });
      }

      const variant = await this.mediaManager.createWebPVariant(file.path, {
        maxWidth: Number(req.body?.maxWidth) || undefined,
        maxHeight: Number(req.body?.maxHeight) || undefined,
        quality: Number(req.body?.quality) || undefined,
      });

      if (file.optimizedPath && file.optimizedPath !== variant.path) {
        try { await this.mediaManager.remove(file.optimizedPath); } catch { /* ignore if missing */ }
      }

      await this.db.update(Schema.media, { id: Number(id) }, {
        optimizedPath: variant.path,
        optimizedSize: variant.size,
        optimizedWidth: variant.width,
        optimizedHeight: variant.height,
      });

      const savedBytes = variant.originalSize - variant.size;
      const savedPercent = Math.round((savedBytes / variant.originalSize) * 100);

      res.json({
        id: Number(id),
        optimizedUrl: ApiUrlUtils.sitePublicUrl(await ApiUrlUtils.resolveSitePublicOrigin(req as Request), variant.url),
        optimizedPath: variant.path,
        optimizedSize: variant.size,
        optimizedWidth: variant.width,
        optimizedHeight: variant.height,
        originalSize: variant.originalSize,
        savedBytes,
        savedPercent,
      });
    } catch (err: any) {
      this.logger.error(`Optimize image error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }
}
