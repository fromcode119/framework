import Redis from 'ioredis';
import { CacheDriver } from '../index';

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
