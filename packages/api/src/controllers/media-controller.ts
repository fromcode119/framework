import { Request, Response } from 'express';
import { PluginManager, Logger } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { media, IDatabaseManager } from '@fromcode119/database';
import { ApiUrlUtils } from '../utils/url';
import { MediaFolderController } from './media-folder-controller';

export class MediaController {
  private db: IDatabaseManager;
  private logger = new Logger({ namespace: 'media-controller' });
  private folders: MediaFolderController;

  constructor(private manager: PluginManager, private mediaManager: MediaManager) {
    this.db = (manager as any).db;
    this.folders = new MediaFolderController(this.db);
  }

  async upload(req: any, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folderId = req.body.folderId ? parseInt(req.body.folderId) : null;

    try {
      this.logger.debug(`Uploading file: ${req.file.originalname} into folder ${folderId}`);
      const result = await this.mediaManager.upload(req.file.buffer, req.file.originalname);
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
        folder_id: folderId
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
        createdAt: insertedRaw?.created_at ?? insertedRaw?.createdAt,
        updatedAt: insertedRaw?.updated_at ?? insertedRaw?.updatedAt
      };

      res.json({ ...inserted, url: ApiUrlUtils.resolvePublicUrl(req as Request, result.url) });
    } catch (err: any) {
      this.logger.error(`Upload error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async listFiles(req: Request, res: Response) {
    const { q, folderId } = req.query;
    try {
      let conditions: any[] = [];
      const { or, and, eq, isNull, desc } = this.db;
      
      if (q) {
        conditions.push(or(
           this.db.like(media.originalName, `%${q}%`),
           this.db.like(media.filename, `%${q}%`)
        ));
      }

      if (folderId !== undefined) {
        const targetFolder = folderId === 'null' ? null : Number(folderId);
        conditions.push(targetFolder === null ? isNull(media.folderId) : eq(media.folderId, targetFolder));
      }

      const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;

      let files: any[] = [];
      try {
        files = await this.db.find(media, {
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
                optimizedPath: true,
                optimizedSize: true,
                optimizedWidth: true,
                optimizedHeight: true,
                createdAt: true,
                updatedAt: true,
            },
            where: whereClause,
            orderBy: this.db.desc(media.createdAt)
        });
      } catch (err) {
        // Fallback for older schemas missing optional columns
        this.logger.warn('Media list fallback to basic columns', err);
        files = await this.db.find(media, {
            columns: {
                id: true,
                filename: true,
                mimeType: true,
                fileSize: true,
                path: true,
                createdAt: true,
            },
            where: whereClause,
            orderBy: this.db.desc(media.createdAt)
        });
      }

      res.json(
        files.map((f: any) => ({
          ...f,
          url: ApiUrlUtils.resolvePublicUrl(req, this.mediaManager.driver.getUrl(f.path)),
          optimizedUrl: f.optimizedPath
            ? ApiUrlUtils.resolvePublicUrl(req, this.mediaManager.driver.getUrl(f.optimizedPath))
            : null,
        }))
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
    const { folderId } = req.body;
    try {
      const updated = await this.db.update(
        media,
        { id: Number(id) },
        { folderId: folderId === 'null' ? null : Number(folderId) }
      );
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
      const file: any = await this.db.findOne(media, { id: Number(id) });
      if (!file) return res.status(404).json({ error: 'File not found' });

      await this.mediaManager.remove(file.path);
      if (file.optimizedPath) {
        try { await this.mediaManager.remove(file.optimizedPath); } catch { /* ignore if missing */ }
      }
      await this.db.delete(media, { id: Number(id) });
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async optimizeImage(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const file: any = await this.db.findOne(media, { id: Number(id) });
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

      await this.db.update(media, { id: Number(id) }, {
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
