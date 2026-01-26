export interface CacheDriver {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
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
