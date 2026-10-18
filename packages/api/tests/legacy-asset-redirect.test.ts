import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegacyApiPathUsage } from '@api/middlewares/legacy-api-path-usage';
import { UnversionedApiAliasMiddleware } from '@api/middlewares/unversioned-api-alias-middleware';

/**
 * A crawler that cached `/api/v1/themes/<slug>/ui/og.png` keeps asking for it until it is told the file
 * moved. Files get a permanent redirect; api calls keep the silent alias.
 */
describe('legacy asset addresses', () => {
  afterEach(() => { LegacyApiPathUsage.flush(); vi.unstubAllEnvs(); });

  const run = (method: string, url: string) => {
    const req: any = { method, url, originalUrl: url, headers: {} };
    const res: any = { redirect: vi.fn() };
    const next = vi.fn();
    new UnversionedApiAliasMiddleware().middleware()(req, res, next);
    return { req, res, next };
  };

  it.each([
    ['GET', '/api/v1/themes/aurora/ui/images/og-default.png', '/api/themes/aurora/ui/images/og-default.png'],
    ['HEAD', '/api/v1/themes/aurora/public/logo.svg?v=2', '/api/themes/aurora/public/logo.svg?v=2'],
    ['GET', '/api/v1/plugins/box/ui/frontend.js?v=0.1.7', '/api/plugins/box/ui/frontend.js?v=0.1.7'],
  ])('redirects %s %s permanently', (method, url, target) => {
    const { res, next } = run(method, url);
    expect(res.redirect).toHaveBeenCalledWith(301, target);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', '/api/v1/themes/aurora/ui/images/og-default.png'],
    ['GET', '/api/v1/plugins/box/catalog'],
    ['GET', '/api/v1/auth/sso/google/callback?code=x'],
    ['PUT', '/api/v1/collections/items/7'],
  ])('keeps the silent alias for %s %s', (method, url) => {
    const { req, res, next } = run(method, url);
    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(req.url.startsWith('/api/v1')).toBe(false);
  });

  it('does not redirect when a version is configured', () => {
    vi.stubEnv('API_VERSION_PREFIX', 'v1');
    const { res, next } = run('GET', '/api/themes/aurora/ui/images/og-default.png');
    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('answers 301 with the new address over real HTTP', async () => {
    const express = (await import('express')).default;
    const app = express();
    app.use(new UnversionedApiAliasMiddleware().middleware());
    app.get('/api/themes/aurora/ui/og.png', (_req, res) => { res.type('png').send('png'); });
    const server = app.listen(0);
    const port = (server.address() as any).port;
    try {
      const moved = await fetch(`http://127.0.0.1:${port}/api/v1/themes/aurora/ui/og.png`, { redirect: 'manual' });
      expect(moved.status).toBe(301);
      expect(moved.headers.get('location')).toBe('/api/themes/aurora/ui/og.png');
      const followed = await fetch(`http://127.0.0.1:${port}/api/v1/themes/aurora/ui/og.png`);
      expect(followed.status).toBe(200);
      expect(await followed.text()).toBe('png');
    } finally {
      server.close();
    }
  });
});
