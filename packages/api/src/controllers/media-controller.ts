import { Request, Response } from 'express';
import { BaseController, PluginManager, Logger, MediaVisibility, SystemConstants } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { IDatabaseManager, Schema } from '@fromcode119/database';
import { ApiUrlUtils } from '@api/utils/url';
import { MediaFolderController } from '@api/controllers/media-folder-controller';
import { MediaVisibilityTransferService } from '@api/services/media-visibility-transfer-service';

export class MediaController extends BaseController {
  private db: IDatabaseManager;
  private logger = new Logger({ namespace: 'media-controller' });
  private folders: MediaFolderController;

  private readonly transfers: MediaVisibilityTransferService;

  constructor(private manager: PluginManager, private mediaManager: MediaManager) {
    super();
    this.db = (manager as any).db;
    this.folders = new MediaFolderController(this.db);
    this.transfers = new MediaVisibilityTransferService(mediaManager);
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
  private publicUrlFor(req: Request, filePath: string, visibility: MediaVisibility): string | null {
    // The visibility value IS the storage-space name — that correspondence is deliberate, so there is
    // no mapping table to drift.
    const url = this.mediaManager.publicUrl(filePath, visibility.value);
    return url ? ApiUrlUtils.resolvePublicUrl(req, url) : null;
  }

  async upload(req: any, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folderId = req.body.folderId ? parseInt(req.body.folderId) : null;
    // multer's `.single()` puts every non-file multipart field on req.body as a string, which is how
    // `folderId` above arrives too.
    const visibility = MediaVisibility.resolve(req.body.visibility);

    try {
      this.logger.debug(`Uploading file: ${req.file.originalname} into folder ${folderId}`);
      const result = await this.mediaManager.upload(req.file.buffer, req.file.originalname, { space: visibility.value });
      const uploadProvider = (result as any).provider || (this.mediaManager as any).provider || 'local';

      const dbManager = (this.manager as any).db;
      const baseInsert: Record<string, any> = {
        filename: result.path,
        original_name: req.file.originalname,
        mime_type: result.mimeType,
        file_size: result.size,
        width: result.width,
        height: result.height,
        path: result.path,
        folder_id: folderId,
        visibility: visibility.value
      };

      let insertedRaw: any;
      try {
        insertedRaw = await dbManager.insert('media', {
          ...baseInsert,
          provider: uploadProvider,
          integration: 'storage'
        });
      } catch (err: any) {
        const message = String(err?.message || '');
        const missingProvider = message.includes('column "provider" does not exist');
        const missingIntegration = message.includes('column "integration" does not exist');
        if (!missingProvider && !missingIntegration) throw err;

        insertedRaw = await dbManager.insert('media', baseInsert);
      }

      const inserted = {
        id: insertedRaw?.id,
        filename: insertedRaw?.filename,
        originalName: insertedRaw?.original_name ?? insertedRaw?.originalName,
        mimeType: insertedRaw?.mime_type ?? insertedRaw?.mimeType,
        fileSize: insertedRaw?.file_size ?? insertedRaw?.fileSize,
        width: insertedRaw?.width,
        height: insertedRaw?.height,
        alt: insertedRaw?.alt ?? null,
        caption: insertedRaw?.caption ?? null,
        path: insertedRaw?.path,
        folderId: insertedRaw?.folder_id ?? insertedRaw?.folderId ?? null,
        provider: insertedRaw?.provider ?? uploadProvider,
        integration: insertedRaw?.integration ?? 'storage',
        visibility: MediaVisibility.resolve(insertedRaw?.visibility ?? visibility).value,
        createdAt: insertedRaw?.created_at ?? insertedRaw?.createdAt,
        updatedAt: insertedRaw?.updated_at ?? insertedRaw?.updatedAt
      };

      res.json({ ...inserted, url: result.url ? ApiUrlUtils.resolvePublicUrl(req as Request, result.url) : null });
    } catch (err: any) {
      this.logger.error(`Upload error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  /** Default page size. Small enough that a wide grid fills without loading the whole library. */
  private static readonly LIST_LIMIT = 60;

  async listFiles(req: Request, res: Response) {
    const { q, folderId } = req.query;
    // Paged from here on. The library used to fetch EVERY media row on each folder change and each
    // debounced search keystroke, which a denser grid would only have made heavier.
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || MediaController.LIST_LIMIT));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    try {
      let conditions: any[] = [];
      const { or, and, eq, isNull, desc } = this.db;
      
      if (q) {
        conditions.push(or(
           this.db.like(Schema.media.originalName, `%${q}%`),
           this.db.like(Schema.media.filename, `%${q}%`)
        ));
      }

      if (folderId !== undefined) {
        const targetFolder = folderId === 'null' ? null : Number(folderId);
        conditions.push(targetFolder === null ? isNull(Schema.media.folderId) : eq(Schema.media.folderId, targetFolder));
      }

      const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;

      let files: any[] = [];
      try {
        files = await this.db.find(Schema.media, {
            columns: {
                id: true,
                filename: true,
                originalName: true,
                mimeType: true,
                fileSize: true,
                width: true,
                height: true,
                alt: true,
                caption: true,
                path: true,
                folderId: true,
                visibility: true,
                optimizedPath: true,
                optimizedSize: true,
                optimizedWidth: true,
                optimizedHeight: true,
                createdAt: true,
                updatedAt: true,
            },
            where: whereClause,
            orderBy: this.db.desc(Schema.media.createdAt),
            limit,
            offset
        });
      } catch (err) {
        // Fallback for older schemas missing optional columns
        this.logger.warn('Media list fallback to basic columns', err);
        files = await this.db.find(Schema.media, {
            columns: {
                id: true,
                filename: true,
                mimeType: true,
                fileSize: true,
                path: true,
                createdAt: true,
            },
            where: whereClause,
            orderBy: this.db.desc(Schema.media.createdAt),
            limit,
            offset
        });
      }

      res.json(
        files.map((f: any) => {
          // The fallback query above omits `visibility`; resolve() reads that absence as PUBLIC, which
          // is correct — a row from a schema too old to have the column is a file in the public tree.
          const visibility = MediaVisibility.resolve(f.visibility);
          return {
            ...f,
            visibility: visibility.value,
            url: this.publicUrlFor(req, f.path, visibility),
            optimizedUrl: f.optimizedPath && !visibility.isPrivate
              ? ApiUrlUtils.resolvePublicUrl(req, this.mediaManager.driver.getUrl(f.optimizedPath))
              : null,
          };
        })
      );
    } catch (err: any) {
      this.logger.error(`Failed to fetch media: ${err.message}`, err);
      res.status(500).json({ error: `Failed to fetch media: ${err.message}` });
    }
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
        optimizedUrl: ApiUrlUtils.resolvePublicUrl(req as Request, variant.url),
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
