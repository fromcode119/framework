import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnversionedApiAliasMiddleware } from '@api/middlewares/unversioned-api-alias-middleware';

describe('UnversionedApiAliasMiddleware', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  describe('legacy versioned addresses', () => {
    it('rewrites a legacy versioned path to the bare one', () => {
      expect(UnversionedApiAliasMiddleware.rewrite('/api/v1/auth/sso/google/callback?code=x'))
        .toBe('/api/auth/sso/google/callback?code=x');
      expect(UnversionedApiAliasMiddleware.rewrite('/api/v1')).toBe('/api');
      expect(UnversionedApiAliasMiddleware.rewrite('/api/v1?x=1')).toBe('/api?x=1');
      expect(UnversionedApiAliasMiddleware.rewrite('/api/v2/users')).toBe('/api/users');
    });

    it('leaves bare paths and look-alikes untouched', () => {
      for (const url of ['/api/users', '/api/videos/1', '/api/health', '/api/ready', '/apiary', '/uploads/a.png', '/']) {
        expect(UnversionedApiAliasMiddleware.rewrite(url)).toBe(url);
      }
    });
  });

  it('ignores the retired version variables — the api is never mounted under a version', () => {
    vi.stubEnv('API_VERSION_PREFIX', 'v1');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/v1/users')).toBe('/api/users');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/users')).toBe('/api/users');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/health')).toBe('/api/health');
  });

  it('follows a configured base path instead of a literal /api', () => {
    vi.stubEnv('API_URL', 'https://example.com/mapi');
    expect(UnversionedApiAliasMiddleware.rewrite('/mapi/v1/users')).toBe('/mapi/users');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/v1/users')).toBe('/api/v1/users');
  });

  it('rewrites url and originalUrl before calling next', () => {
    const req: any = { method: 'GET', url: '/api/v1/users', originalUrl: '/api/v1/users', headers: {} };
    const next = vi.fn();
    new UnversionedApiAliasMiddleware().middleware()(req, {} as any, next);
    expect(req.url).toBe('/api/users');
    expect(req.originalUrl).toBe('/api/users');
    expect(next).toHaveBeenCalledOnce();
  });

  it('serves a router mounted at the configured prefix through both paths', async () => {
    const express = (await import('express')).default;
    const app = express();
    app.use(new UnversionedApiAliasMiddleware().middleware());
    const api = express.Router();
    api.get('/auth/sso/:provider/callback', (req, res) => { res.json({ provider: req.params.provider, code: req.query.code }); });
    app.use('/api', api);
    const server = app.listen(0);
    const port = (server.address() as any).port;
    try {
      for (const path of ['/api/auth/sso/google/callback?code=a', '/api/v1/auth/sso/google/callback?code=a']) {
        const res = await fetch(`http://127.0.0.1:${port}${path}`);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ provider: 'google', code: 'a' });
      }
    } finally {
      server.close();
    }
  });
});
