import type { CacheDriver } from './cache-factory.interfaces';
import type { CacheDriverCreator } from './cache-factory.types';


export class CacheFactory {
  private static drivers: Map<string, CacheDriverCreator> = new Map();

  static register(name: string, creator: CacheDriverCreator) {
    this.drivers.set(name, creator);
  }

  static create(name: string, config: any): CacheDriver {
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
      const { RedisCacheDriver } = require('./drivers/redis');
      return new RedisCacheDriver(config.url);
    });
    this.register('memory', () => {
      const { MemoryCacheDriver } = require('./drivers/memory');
      return new MemoryCacheDriver();
    });
  }
}
