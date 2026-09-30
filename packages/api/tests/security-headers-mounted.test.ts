import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ServerMiddlewareSetup } from '@api/server/server-middleware-setup';
import { SecurityHeadersMiddleware } from '@api/middlewares/security-headers-middleware';

/**
 * Every api response carries the security headers — even one a later middleware ends early (a refusal,
 * an error). `SecurityHeadersMiddleware` existed and was exported, but nothing mounted it: no response
 * on production had any of them, and Express advertised itself in `x-powered-by`.
 */
describe('api security headers', () => {
  const app = () => {
    const server = express();
    // The first thing after the headers answers every request, the way a refusal would.
    const manager: any = { middlewares: { dispatch: (_stage: unknown, _req: unknown, res: express.Response) => res.status(418).end() } };
    new ServerMiddlewareSetup(server, { middleware: () => (_req: unknown, _res: unknown, next: () => void) => next() } as any, manager, async () => false, { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any).setup();
    return server;
  };

  it('are on a response a later middleware ended, and Express is not named', async () => {
    const res = await request(app()).get('/api/v1/anything');
    expect(res.status).toBe(418);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('pins HTTPS only in production, only over HTTPS, and never a customer domain\'s subdomains', async () => {
    const env = process.env.NODE_ENV;
    try {
      const probe = express();
      probe.use(new SecurityHeadersMiddleware().middleware());
      probe.get('/x', (_req, res) => { res.end(); });
      process.env.NODE_ENV = 'production';
      expect((await request(probe).get('/x').set('X-Forwarded-Proto', 'https')).headers['strict-transport-security']).toBe('max-age=31536000');
      expect((await request(probe).get('/x')).headers['strict-transport-security']).toBeUndefined();
      process.env.NODE_ENV = 'development';
      expect((await request(probe).get('/x').set('X-Forwarded-Proto', 'https')).headers['strict-transport-security']).toBeUndefined();
    } finally {
      process.env.NODE_ENV = env;
    }
  });

  it('sets no framing rule — the console frames api-served previews, and pages set their own', async () => {
    const res = await request(app()).get('/api/v1/anything');
    expect(res.headers['x-frame-options']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
