import type { IStorageDriver } from '@media/interfaces/storage-driver.interface';
import type { IStorageDriverCreator } from '@media/interfaces/storage-driver-creator.interface';

export class StorageFactory {
  private static drivers: Map<string, IStorageDriverCreator> = new Map();

  static register(name: string, creator: IStorageDriverCreator) {
    this.drivers.set(name, creator);
  }

  static create(name: string, config: any): IStorageDriver {
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
      const { LocalStorageDriver } = require('@media/drivers/local-driver');
      return new LocalStorageDriver(config.uploadDir, config.publicUrlBase);
    });
    this.register('s3', (config) => {
      const { S3StorageDriver } = require('@media/drivers/s3-driver');
      return new S3StorageDriver({ ...config, provider: 's3' });
    });
    this.register('r2', (config) => {
      const { S3StorageDriver } = require('@media/drivers/s3-driver');
      return new S3StorageDriver({ ...config, provider: 'r2' });
    });
  }
}
