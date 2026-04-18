import path from 'path';
import type { StorageDriver } from './storage-factory.interfaces';
import { MediaImageOptimizer } from './media-image-optimizer';

export class MediaManager {
  public driver: StorageDriver;

  constructor(driver: StorageDriver) {
    this.driver = driver;
  }

  get provider() { return this.driver.provider; }

  async upload(file: Buffer, filename: string): Promise<{ url: string; path: string; width?: number; height?: number; size: number; mimeType: string; provider: string }> {
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
    let payload = file;
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    let width: number | undefined;
    let height: number | undefined;

    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const optimized = await MediaImageOptimizer.optimizeBuffer(file, filename);
        payload = optimized.buffer;
        width = optimized.width;
        height = optimized.height;
    }

    const filePath = await this.driver.save(payload, filename);
    
    return {
      url: this.driver.getUrl(filePath),
      path: filePath,
      width,
      height,
      size: payload.length,
      mimeType,
      provider: this.driver.provider
    };
  }

  async remove(filepath: string): Promise<void> {
    await this.driver.delete(filepath);
  }
}
