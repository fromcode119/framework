import Redis from 'ioredis';

export interface CacheDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export class RedisCacheDriver implements CacheDriver {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

export class MemoryCacheDriver implements CacheDriver {
  private cache = new Map<string, { value: string; expiry: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiry = ttl ? Date.now() + ttl * 1000 : null;
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
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
