import type Redis from 'ioredis';

/**
 * Fixed-window hit counters in Redis, shared by every api worker: the count and the window's
 * remaining time come back from one atomic script, so concurrent workers can never both see "first
 * hit" and restart the window.
 */
export class RedisWindowCounter {
  private static readonly INCREMENT = `
    local hits = redis.call('INCR', KEYS[1])
    if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
    local ttl = redis.call('PTTL', KEYS[1])
    if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
    return { hits, ttl }`;

  private readonly redis: Redis;

  constructor(redisUrl: string, private readonly prefix: string) {
    const RedisClass = require('ioredis');
    this.redis = new RedisClass(redisUrl);
  }

  /** One hit on `key`; the hits so far this window and the milliseconds until it resets. */
  async increment(key: string, windowMs: number): Promise<{ hits: number; resetInMs: number }> {
    const [hits, ttl] = (await this.redis.eval(RedisWindowCounter.INCREMENT, 1, this.prefix + key, String(windowMs))) as [number, number];
    return { hits: Number(hits), resetInMs: Number(ttl) };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(this.prefix + key);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
