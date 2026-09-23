import { ApiUrlUtils } from '@api/utils/url';
import { BaseController, PluginManager, Logger, MediaVisibility, SystemConstants } from '@fromcode119/core';
import { IDatabaseManager, Schema } from '@fromcode119/database';
import { Request, Response } from 'express';
import { MediaManager } from '@fromcode119/media';

/**
 * Putting files IN and reading them back out — the two halves of the library that move bytes.
 *
 * They are here together because they are two ends of one decision: where an upload is stored
 * determines the URL that serves it, and the listing has to report that same answer. A private file
 * gets no public URL at all rather than a URL that will 404, which is how the caller can tell the
 * difference between "not shared" and "missing".
 *
 * Split out of `MediaController` (392 lines), which keeps streaming, optimisation and visibility
 * changes, and delegates folder CRUD to MediaFolderController.
 */
export class MediaLibraryController {
  constructor(
    private readonly db: any,
    private readonly logger: any,
    private readonly manager: PluginManager,
    private readonly mediaManager: MediaManager,
    private readonly publicUrlFor: (origin: string, filePath: string, visibility: MediaVisibility) => string | null,
  ) {}

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

      const origin = await ApiUrlUtils.resolveSitePublicOrigin(req as Request);
      res.json({ ...inserted, url: result.url ? ApiUrlUtils.sitePublicUrl(origin, result.url) : null });
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
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || MediaLibraryController.LIST_LIMIT));
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

      // Once per request, not per row: every file in one listing belongs to the same site.
      const origin = await ApiUrlUtils.resolveSitePublicOrigin(req);
      res.json(
        files.map((f: any) => {
          // The fallback query above omits `visibility`; resolve() reads that absence as PUBLIC, which
          // is correct — a row from a schema too old to have the column is a file in the public tree.
          const visibility = MediaVisibility.resolve(f.visibility);
          return {
            ...f,
            visibility: visibility.value,
            url: this.publicUrlFor(origin, f.path, visibility),
            optimizedUrl: f.optimizedPath && !visibility.isPrivate
              ? ApiUrlUtils.sitePublicUrl(origin, this.mediaManager.driver.getUrl(f.optimizedPath))
              : null,
          };
        })
      );
    } catch (err: any) {
      this.logger.error(`Failed to fetch media: ${err.message}`, err);
      res.status(500).json({ error: `Failed to fetch media: ${err.message}` });
    }
  }
}
