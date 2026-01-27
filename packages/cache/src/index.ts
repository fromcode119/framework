export interface CacheDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export type CacheDriverCreator = (config: any) => CacheDriver;

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

export class CacheManager {
  constructor(private driver: CacheDriver) {}

  async get<T = any>(key: string): Promise<T | null> {
    const val = await this.driver.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val as any;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
    await this.driver.set(key, stringVal, ttl);
  }

  async del(key: string): Promise<void> {
    await this.driver.del(key);
  }
}
