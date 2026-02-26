import { Request, Response } from 'express';
import { PluginManager, Logger } from '@fromcode119/core';
import { MediaManager } from '@fromcode119/media';
import { media, mediaFolders, IDatabaseManager } from '@fromcode119/database';
import { resolvePublicUrl } from '../utils/url';

export class MediaController {
  private db: IDatabaseManager;
  private logger = new Logger({ namespace: 'media-controller' });

  constructor(private manager: PluginManager, private mediaManager: MediaManager) {
    this.db = (manager as any).db;
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

      res.json({ ...inserted, url: resolvePublicUrl(req as Request, result.url) });
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
                createdAt: true,
                updatedAt: true,
            },
            where: whereClause,
            orderBy: desc(media.createdAt)
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
            orderBy: desc(media.createdAt)
        });
      }

      res.json(
        files.map((f: any) => ({
          ...f,
          url: resolvePublicUrl(req, this.mediaManager.driver.getUrl(f.path))
        }))
      );
    } catch (err: any) {
      this.logger.error(`Failed to fetch media: ${err.message}`, err);
      res.status(500).json({ error: `Failed to fetch media: ${err.message}` });
    }
  }

  async listFolders(req: Request, res: Response) {
    const { parentId } = req.query;
    try {
      const targetParent = parentId === 'null' ? null : (parentId ? Number(parentId) : null);
      const folders = await this.db.find(mediaFolders, {
        where: targetParent === null ? this.db.isNull(mediaFolders.parentId) : this.db.eq(mediaFolders.parentId, targetParent),
        orderBy: mediaFolders.name
      });
      res.json(folders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async createFolder(req: Request, res: Response) {
    const { name, parentId } = req.body;
    try {
      const pId = parentId ? Number(parentId) : null;
      
      // Check for duplicates
      const [existing] = await this.db.find(mediaFolders, {
        where: this.db.and(
            this.db.eq(mediaFolders.name, name),
            pId === null ? this.db.isNull(mediaFolders.parentId) : this.db.eq(mediaFolders.parentId, pId)
          ),
        limit: 1
      });

      if (existing) {
        return res.status(400).json({ error: 'A folder with this name already exists here' });
      }

      const folder = await this.db.insert(mediaFolders, {
        name,
        parentId: pId
      });
      res.json(folder);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateFolder(req: Request, res: Response) {
    const { id } = req.params;
    const { name, parentId } = req.body;
    try {
      const folderId = Number(id);
      const pId = parentId !== undefined ? (parentId === 'null' ? null : Number(parentId)) : undefined;

      if (pId !== undefined) {
        if (folderId === pId) {
          return res.status(400).json({ error: 'Cannot move a folder into itself' });
        }
        
        // Prevent moving a folder into its own descendants
        if (pId !== null) {
          let checkParentId: number | null = pId;
          while (checkParentId !== null) {
            const [parent]: any = await this.db.select().from(mediaFolders).where(eq(mediaFolders.id, checkParentId)).limit(1);
            if (!parent) break;
            if (parent.parentId === folderId) {
              return res.status(400).json({ error: 'Cannot move a folder into its own descendant' });
            }
            checkParentId = parent.parentId;
          }
        }
      }

      // Check for name duplicates if name or parentId is changing
      if (name || pId !== undefined) {
        const [existingFolder]: any = await this.db.select().from(mediaFolders).where(eq(mediaFolders.id, folderId)).limit(1);
        const finalName = name || existingFolder.name;
        const finalParentId = pId !== undefined ? pId : existingFolder.parentId;

        // Simplified duplicate check logic
        const conditions = [
          eq(mediaFolders.name, finalName),
          finalParentId === null ? isNull(mediaFolders.parentId) : eq(mediaFolders.parentId, finalParentId)
        ];
        
        const [dup]: any = await this.db.select().from(mediaFolders).where(and(...conditions)).limit(1);
        if (dup && dup.id !== folderId) {
          return res.status(400).json({ error: 'A folder with this name already exists in the target location' });
        }
      }

      const [updated] = await this.db.update(mediaFolders)
        .set({ 
          ...(name && { name }), 
          ...(parentId !== undefined && { parentId: parentId === 'null' ? null : Number(parentId) }) 
        })
        .where(eq(mediaFolders.id, folderId))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateFile(req: Request, res: Response) {
    const { id } = req.params;
    const { folderId } = req.body;
    try {
      const [updated] = await this.db.update(media)
        .set({ folderId: folderId === 'null' ? null : Number(folderId) })
        .where(eq(media.id, Number(id)))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getFolderPath(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const folderPath: any[] = [];
      let currentId: number | null = Number(id);
      
      while (currentId) {
        const [folder]: any = await this.db.select().from(mediaFolders).where(eq(mediaFolders.id, currentId)).limit(1);
        if (!folder) break;
        folderPath.unshift(folder);
        currentId = folder.parentId;
      }
      
      res.json(folderPath);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async deleteFolder(req: Request, res: Response) {
    const { id } = req.params;
    try {
      // For now, we just delete the folder. Media items with this folderId will have it set to null due to FK constraint.
      await this.db.delete(mediaFolders).where(eq(mediaFolders.id, Number(id)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async deleteFile(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const [file]: any = await this.db.select().from(media).where(eq(media.id, Number(id))).limit(1);
      if (!file) return res.status(404).json({ error: 'File not found' });

      await this.mediaManager.remove(file.path);
      await this.db.delete(media).where(eq(media.id, Number(id)));
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
