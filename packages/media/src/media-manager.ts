import path from 'path';
import type { StorageDriver } from './storage-factory.interfaces';
import { MediaImageOptimizer } from './media-image-optimizer';
import type { MediaWebPConversionOptions } from './media-image-optimizer.interfaces';

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

  /**
   * Reads an existing stored file, converts it to WebP, and saves the result
   * alongside the original. The original is never modified.
   *
   * @param originalPath - Stored path of the original file (as in the DB `path` column)
   * @param options - Optional resize/quality settings
   * @returns Stored path, URL, dimensions, and byte sizes of the WebP variant
   */
  async createWebPVariant(
    originalPath: string,
    options?: MediaWebPConversionOptions,
  ): Promise<{ path: string; url: string; width: number; height: number; size: number; originalSize: number }> {
    const original = await this.driver.read(originalPath);
    const result = await MediaImageOptimizer.convertToWebP(original, options);

    const baseName = path.basename(originalPath, path.extname(originalPath));
    const webpFilename = `${baseName}.webp`;
    const savedPath = await this.driver.save(result.buffer, webpFilename);

    return {
      path: savedPath,
      url: this.driver.getUrl(savedPath),
      width: result.width,
      height: result.height,
      size: result.convertedSize,
      originalSize: result.originalSize,
    };
  }

  async remove(filepath: string): Promise<void> {
    await this.driver.delete(filepath);
  }
}
