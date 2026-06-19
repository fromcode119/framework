import { Request, Response } from 'express';
import { mediaFolders, IDatabaseManager } from '@fromcode119/database';

/**
 * Media folder CRUD handlers. Extracted from MediaController to keep each file
 * under the size limit; MediaController instantiates this with the same
 * database manager and delegates each public handler, so route wiring and
 * behavior are unchanged.
 */
export class MediaFolderController {
  constructor(private db: IDatabaseManager) {}

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
            const parent: any = await this.db.findOne(mediaFolders, { id: checkParentId });
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
        const existingFolder: any = await this.db.findOne(mediaFolders, { id: folderId });
        const finalName = name || existingFolder.name;
        const finalParentId = pId !== undefined ? pId : existingFolder.parentId;

        // Simplified duplicate check logic
        const conditions = [
          this.db.eq(mediaFolders.name, finalName),
          finalParentId === null ? this.db.isNull(mediaFolders.parentId) : this.db.eq(mediaFolders.parentId, finalParentId)
        ];

        const [dup]: any = await this.db.find(mediaFolders, {
          where: this.db.and(...conditions),
          limit: 1
        });
        if (dup && dup.id !== folderId) {
          return res.status(400).json({ error: 'A folder with this name already exists in the target location' });
        }
      }

      const updated = await this.db.update(
        mediaFolders,
        { id: folderId },
        {
          ...(name && { name }),
          ...(parentId !== undefined && { parentId: parentId === 'null' ? null : Number(parentId) })
        }
      );
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
        const folder: any = await this.db.findOne(mediaFolders, { id: currentId });
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
      await this.db.delete(mediaFolders, { id: Number(id) });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
