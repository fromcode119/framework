import type { ICacheDriver } from '@cache/interfaces/cache-driver.interface';
import type { ICacheDriverCreator } from '@cache/interfaces/cache-driver-creator.interface';

export class CacheFactory {
  private static drivers: Map<string, ICacheDriverCreator> = new Map();

  static register(name: string, creator: ICacheDriverCreator) {
    this.drivers.set(name, creator);
  }

  static create(name: string, config: any): ICacheDriver {
    if (this.drivers.size === 0) {
      this.registerDefaults();
    }

    const creator = this.drivers.get(name);
    if (!creator) {
      throw new Error(`Cache driver "${name}" not found.`);
    }
    return creator(config);
  }

  private static registerDefaults() {
    this.register('redis', (config) => {
      const { RedisCacheDriver } = require('@cache/drivers/redis');
      return new RedisCacheDriver(config.url);
    });
    this.register('memory', () => {
      const { MemoryCacheDriver } = require('@cache/drivers/memory');
      return new MemoryCacheDriver();
    });
  }
}
