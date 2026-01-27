import path from 'path';
import sharp from 'sharp';

export interface StorageDriver {
  save(file: Buffer, filename: string, options?: any): Promise<string>;
  delete(filepath: string): Promise<void>;
  getUrl(filepath: string): string;
}

export type StorageDriverCreator = (config: any) => StorageDriver;

export class StorageFactory {
  private static drivers: Map<string, StorageDriverCreator> = new Map();

  static register(name: string, creator: StorageDriverCreator) {
    this.drivers.set(name, creator);
  }

  static create(name: string, config: any): StorageDriver {
    // Register defaults on first use
    if (this.drivers.size === 0) {
      this.registerDefaults();
    }

    const creator = this.drivers.get(name);
    if (!creator) {
      throw new Error(`Storage driver "${name}" not found. Available: ${Array.from(this.drivers.keys()).join(', ')}`);
    }
    return creator(config);
  }

  private static registerDefaults() {
    this.register('local', (config) => {
      const { LocalStorageDriver } = require('./drivers/local-driver');
      return new LocalStorageDriver(config.uploadDir, config.publicUrlBase);
    });
    this.register('s3', (config) => {
      const { S3StorageDriver } = require('./drivers/s3-driver');
      return new S3StorageDriver(config);
    });
    this.register('r2', (config) => {
      const { S3StorageDriver } = require('./drivers/s3-driver');
      return new S3StorageDriver(config);
    });
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
