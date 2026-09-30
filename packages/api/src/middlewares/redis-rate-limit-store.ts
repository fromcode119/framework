import type { IncrementResponse, Options, Store } from 'express-rate-limit';
import { RedisWindowCounter } from '@fromcode119/core';

/**
 * The request limiter's counters in Redis, shared by every api worker. With one worker the limiter
 * keeps its in-memory store; with several, a store per process would let each client through N times
 * the operator's limit.
 */
export class RedisRateLimitStore implements Store {
  private static counter: RedisWindowCounter | null = null;
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;

  constructor(redisUrl: string, windowMs: number) {
    // One connection for the process, whichever limiter is current.
    RedisRateLimitStore.counter ??= new RedisWindowCounter(redisUrl, 'fromcode:rate-limit:');
    // Keyed by the window: a changed window restarts every counter, as the in-memory store does when rebuilt.
    this.prefix = `w${windowMs}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const { hits, resetInMs } = await RedisRateLimitStore.counter!.increment(this.prefix + key, this.windowMs);
    return { totalHits: hits, resetTime: new Date(Date.now() + resetInMs) };
  }

  async decrement(key: string): Promise<void> {
    await RedisRateLimitStore.counter!.decrement(this.prefix + key);
  }

  async resetKey(key: string): Promise<void> {
    await RedisRateLimitStore.counter!.reset(this.prefix + key);
  }
}
