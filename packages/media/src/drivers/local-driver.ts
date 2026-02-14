import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { StorageDriver } from '../index';

export class LocalStorageDriver implements StorageDriver {
  public readonly provider = 'local';
  constructor(private uploadDir: string, private publicUrlBase: string) {}

  async save(file: Buffer, filename: string, options?: any): Promise<string> {
    const ext = path.extname(filename);
    const rawBasename = path.basename(filename, ext);
    // Sanitize filename to avoid issues with spaces or special characters on disk
    const slugifiedBasename = rawBasename
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
        
    const id = uuidv4();
    const newFilename = `${slugifiedBasename || 'file'}-${id}${ext.toLowerCase()}`;
    const fullPath = path.join(this.uploadDir, newFilename);

    await fs.mkdir(this.uploadDir, { recursive: true });
    
    // Simple optimization if it's an image
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase())) {
        await sharp(file)
            .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
            .toFile(fullPath);
    } else {
        await fs.writeFile(fullPath, file);
    }

    return newFilename;
  }

  async delete(filepath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filepath);
    await fs.unlink(fullPath);
  }

  getUrl(filepath: string): string {
    return `${this.publicUrlBase}/${encodeURIComponent(filepath)}`;
  }
}
