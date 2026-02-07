import { Request, Response } from 'express';
import { PluginManager, Logger } from '@fromcode/core';
import { MediaManager } from '@fromcode/media';
import { media, mediaFolders, eq, desc, ilike, or, and, isNull } from '@fromcode/database';

export class MediaController {
  private db: any;
  private logger = new Logger({ namespace: 'MediaController' });

  constructor(private manager: PluginManager, private mediaManager: MediaManager) {
    this.db = (manager as any).db.drizzle;
  }

  async upload(req: any, res: Response) {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folderId = req.body.folderId ? parseInt(req.body.folderId) : null;

    try {
      this.logger.debug(`Uploading file: ${req.file.originalname} into folder ${folderId}`);
      const result = await this.mediaManager.upload(req.file.buffer, req.file.originalname);
      
      const [inserted]: any = await this.db.insert(media).values({
        filename: result.path,
        originalName: req.file.originalname,
        mimeType: result.mimeType,
        fileSize: result.size,
        width: result.width,
        height: result.height,
        path: result.path,
        folderId: folderId
      } as any).returning();

      res.json({
        ...inserted,
        url: result.url
      });
    } catch (err: any) {
      this.logger.error(`Upload error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async listFiles(req: Request, res: Response) {
    const { q, folderId } = req.query;
    try {
      let conditions: any[] = [];
      
      if (q) {
        conditions.push(or(
           ilike(media.originalName, `%${q}%`),
           ilike(media.filename, `%${q}%`)
        ));
      }

      if (folderId !== undefined) {
        const targetFolder = folderId === 'null' ? null : Number(folderId);
        conditions.push(targetFolder === null ? isNull(media.folderId) : eq(media.folderId, targetFolder));
      }

      const whereClause = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;

      const selectFilesFull = async () => {
        return this.db.select({
          id: media.id,
          filename: media.filename,
          originalName: media.originalName,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
          width: media.width,
          height: media.height,
          alt: media.alt,
          caption: media.caption,
          path: media.path,
          folderId: media.folderId,
          createdAt: media.createdAt,
          updatedAt: media.updatedAt,
        }).from(media)
          .where(whereClause)
          .orderBy(desc(media.createdAt));
      };

      const selectFilesBasic = async () => {
        return this.db.select({
          id: media.id,
          filename: media.filename,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
          path: media.path,
          createdAt: media.createdAt,
        }).from(media)
          .where(whereClause)
          .orderBy(desc(media.createdAt));
      };

      let files: any[] = [];
      try {
        files = await selectFilesFull();
      } catch (err) {
        // Fallback for older schemas missing optional columns
        this.logger.warn('Media list fallback to basic columns', err);
        files = await selectFilesBasic();
      }

      res.json(files.map((f: any) => ({
        ...f,
        url: this.mediaManager.driver.getUrl(f.path)
      })));
    } catch (err: any) {
      this.logger.error(`Failed to fetch media: ${err.message}`, err);
      res.status(500).json({ error: `Failed to fetch media: ${err.message}` });
    }
  }

  async listFolders(req: Request, res: Response) {
    const { parentId } = req.query;
    try {
      const targetParent = parentId === 'null' ? null : (parentId ? Number(parentId) : null);
      const folders = await this.db.select()
        .from(mediaFolders)
        .where(targetParent === null ? isNull(mediaFolders.parentId) : eq(mediaFolders.parentId, targetParent))
        .orderBy(mediaFolders.name);
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
      const [existing] = await this.db.select()
        .from(mediaFolders)
        .where(
          and(
            eq(mediaFolders.name, name),
            pId === null ? isNull(mediaFolders.parentId) : eq(mediaFolders.parentId, pId)
          )
        ).limit(1);

      if (existing) {
        return res.status(400).json({ error: 'A folder with this name already exists here' });
      }

      const [folder] = await this.db.insert(mediaFolders).values({
        name,
        parentId: pId
      }).returning();
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
