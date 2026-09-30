import { afterAll, afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import { RateLimitMiddleware } from '@api/middlewares/rate-limit-middleware';

/**
 * Two request limiters on a REAL Redis stand in for two api workers: a client's requests count once,
 * whichever worker serves them. SKIPS without `REDIS_TEST_URL`; point it at a throwaway Redis.
 */
const url = process.env.REDIS_TEST_URL;

describe.skipIf(!url)('request limiter shared by several workers (real Redis)', () => {
  const servers: Array<{ close: () => void }> = [];
  afterEach(() => { delete process.env.API_WORKERS; delete process.env.REDIS_URL; });
  afterAll(() => servers.forEach((server) => server.close()));

  const serve = (limiter: RateLimitMiddleware): Promise<string> => {
    const app = express();
    app.use((req, res, next) => void limiter.handle(req, res, next));
    app.get('/', (_req, res) => { res.json({ ok: true }); });
    return new Promise((resolve) => {
      const server = app.listen(0, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`));
      servers.push(server);
    });
  };

  it('refuses request 11 of a limit of 10, alternating between two workers', async () => {
    process.env.API_WORKERS = '2';
    process.env.REDIS_URL = url;
    // A window no earlier run used, so the shared counters start at zero.
    const windowMs = 60_000 + Math.floor(Math.random() * 100_000);
    const [a, b] = await Promise.all([
      serve(new RateLimitMiddleware({ maxRequests: 10, windowMs })),
      serve(new RateLimitMiddleware({ maxRequests: 10, windowMs })),
    ]);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) statuses.push((await fetch(i % 2 ? b : a)).status);
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('keeps the in-memory store for one worker, Redis or not', () => {
    process.env.REDIS_URL = url;
    const limiter = new RateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 });
    expect((limiter as any).store.constructor.name).toBe('MemoryStore');
  });

  it('lets requests through, rather than failing them, when the shared store is unreachable', async () => {
    process.env.API_WORKERS = '2';
    process.env.REDIS_URL = url;
    const limiter = new RateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 });
    (limiter as any).store = { increment: async () => { throw new Error('connection refused'); }, decrement: async () => undefined, resetKey: async () => undefined, localKeys: false };
    (limiter as any).limiter = (limiter as any).buildLimiter();
    expect((await fetch(await serve(limiter))).status).toBe(200);
  });
});
