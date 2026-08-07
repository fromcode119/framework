import { SystemConstants } from '@fromcode119/core';
import { RateLimitMiddleware } from '@api/middlewares/rate-limit-middleware';

/**
 * The mounted limiter, driven the way Express drives it.
 *
 * Two things are proved here that the bucket rules alone cannot: that SSR-shaped traffic and a
 * genuine anonymous visitor really do land in different budgets once the middleware is in the
 * request path, and that changing "Rate Limit Window" in admin changes behaviour without a restart —
 * `express-rate-limit` bakes the window into its store at construction, so a limiter built once at
 * boot went on counting in the old window while the screen read the new value back.
 */

/** The storefront renderer: a container on the private docker network, calling with no identity. */
const renderRequest = () => ({
  ip: '172.18.0.7',
  method: 'GET',
  headers: {},
  cookies: {},
  socket: { remoteAddress: '::ffff:172.18.0.7' },
  path: '/v1/system/resolve',
  originalUrl: '/api/v1/system/resolve',
});

/** A public visitor arriving through the edge proxy, which itself sits on the private network. */
const visitorRequest = () => ({
  ip: '203.0.113.9',
  method: 'GET',
  headers: {},
  cookies: {},
  socket: { remoteAddress: '::ffff:172.18.0.2' },
  path: '/v1/system/resolve',
  originalUrl: '/api/v1/system/resolve',
});

/**
 * A response stub that records the status and the rate-limit headers the limiter writes, and settles
 * `finished` however the request ends: a permitted request reaches `next()`, a blocked one is
 * answered by the limiter itself and never calls it.
 */
const createRes = () => {
  const headers = new Map<string, unknown>();
  let settle: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => { settle = resolve; });
  return {
    finished,
    settle: () => settle(),
    statusCode: 200,
    setHeader(name: string, value: unknown) { headers.set(String(name).toLowerCase(), value); return this; },
    getHeader(name: string) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name: string) { headers.delete(String(name).toLowerCase()); },
    status(code: number) { this.statusCode = code; return this; },
    send() { settle(); return this; },
    json() { settle(); return this; },
    end() { settle(); return this; },
    on() { return this; },
    once() { return this; },
    removeListener() { return this; },
    writableEnded: false,
    headersSent: false,
  } as any;
};

/** Send `count` requests through the middleware and report the last status and limit header seen. */
const send = async (middleware: any, request: () => Record<string, unknown>, count: number) => {
  let lastStatus = 200;
  let lastLimit: unknown;
  for (let i = 0; i < count; i++) {
    const res = createRes();
    middleware(request() as any, res, () => res.settle());
    await res.finished;
    lastStatus = res.statusCode;
    lastLimit = res.getHeader('ratelimit-limit') ?? res.getHeader('x-ratelimit-limit');
  }
  return { lastStatus, lastLimit };
};

describe('RateLimitMiddleware — buckets in the request path', () => {
  it('lets SSR-shaped traffic through past the public cap while a visitor is blocked at it', async () => {
    const settings = new Map<string, string>([
      [SystemConstants.META_KEY.RATE_LIMIT_MAX, '5'],
      [SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL, '500'],
      [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS, '172.16.0.0/12'],
      [SystemConstants.META_KEY.RATE_LIMIT_WINDOW, '60000'],
    ]);
    const middleware = new RateLimitMiddleware({}, settings).middleware();

    const renderer = await send(middleware, renderRequest, 40);
    expect(renderer.lastStatus).toBe(200);

    const visitor = await send(middleware, visitorRequest, 40);
    expect(visitor.lastStatus).toBe(429);
  });

  it('does not let a caller-supplied header buy the internal budget', async () => {
    const settings = new Map<string, string>([
      [SystemConstants.META_KEY.RATE_LIMIT_MAX, '5'],
      [SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL, '500'],
      [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS, '172.16.0.0/12'],
    ]);
    const middleware = new RateLimitMiddleware({}, settings).middleware();
    const spoofing = () => ({ ...visitorRequest(), headers: { 'x-framework-client': 'frontend-ssr', 'x-internal': 'true' } });

    const result = await send(middleware, spoofing, 40);
    expect(result.lastStatus).toBe(429);
  });

  it('honours an emptied internal-clients list: nothing is internal any more', async () => {
    const settings = new Map<string, string>([
      [SystemConstants.META_KEY.RATE_LIMIT_MAX, '5'],
      [SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL, '500'],
      [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS, ''],
    ]);
    const middleware = new RateLimitMiddleware({}, settings).middleware();

    const renderer = await send(middleware, renderRequest, 40);
    expect(renderer.lastStatus).toBe(429);
  });
});

describe('RateLimitMiddleware — the window control actually changes behaviour', () => {
  it('spends the new window without a restart, instead of counting on in the old one', async () => {
    const settings = new Map<string, string>([
      [SystemConstants.META_KEY.RATE_LIMIT_MAX, '5'],
      [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS, ''],
      [SystemConstants.META_KEY.RATE_LIMIT_WINDOW, '900000'],
    ]);
    const limiter = new RateLimitMiddleware({}, settings);
    const middleware = limiter.middleware();

    expect((await send(middleware, visitorRequest, 40)).lastStatus).toBe(429);

    // The operator saves a different window. The old limiter's counters belong to the old window, so
    // the rebuild starts counting again — and the reset the caller now sees is the one they configured.
    settings.set(SystemConstants.META_KEY.RATE_LIMIT_WINDOW, '1000');
    expect((await send(middleware, visitorRequest, 1)).lastStatus).toBe(200);
  });

  it('rebuilds once per change, not on every request', async () => {
    const settings = new Map<string, string>([
      [SystemConstants.META_KEY.RATE_LIMIT_MAX, '5'],
      [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS, ''],
      [SystemConstants.META_KEY.RATE_LIMIT_WINDOW, '900000'],
    ]);
    const middleware = new RateLimitMiddleware({}, settings).middleware();

    // Four requests with no settings change must keep counting in the SAME bucket, or the limit could
    // never be reached at all.
    expect((await send(middleware, visitorRequest, 6)).lastStatus).toBe(429);
  });
});
