import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export interface StorageDriver {
  save(file: Buffer, filename: string, options?: any): Promise<string>;
  delete(filepath: string): Promise<void>;
  getUrl(filepath: string): string;
}

export class LocalStorageDriver implements StorageDriver {
  constructor(private uploadDir: string, private publicUrlBase: string) {}

  async save(file: Buffer, filename: string, options?: any): Promise<string> {
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const id = uuidv4();
    const newFilename = `${basename}-${id}${ext}`;
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
    return `${this.publicUrlBase}/${filepath}`;
  }
}

export class MediaManager {
  public driver: StorageDriver;

  constructor(driver: StorageDriver) {
    this.driver = driver;
  }

  async upload(file: Buffer, filename: string): Promise<{ url: string; path: string; width?: number; height?: number; size: number; mimeType: string }> {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4'
    };
    
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    let width: number | undefined;
    let height: number | undefined;

    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const metadata = await sharp(file).metadata();
        width = metadata.width;
        height = metadata.height;
    }

    const filePath = await this.driver.save(file, filename);
    
    return {
      url: this.driver.getUrl(filePath),
      path: filePath,
      width,
      height,
      size: file.length,
      mimeType
    };
  }

  async remove(filepath: string): Promise<void> {
    await this.driver.delete(filepath);
  }
}
