import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnversionedApiAliasMiddleware } from '@api/middlewares/unversioned-api-alias-middleware';

describe('UnversionedApiAliasMiddleware', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('rewrites a bare api path to the versioned one', () => {
    expect(UnversionedApiAliasMiddleware.rewrite('/api/auth/sso/google/callback?code=x'))
      .toBe('/api/v1/auth/sso/google/callback?code=x');
    expect(UnversionedApiAliasMiddleware.rewrite('/api')).toBe('/api/v1');
    expect(UnversionedApiAliasMiddleware.rewrite('/api?x=1')).toBe('/api/v1?x=1');
  });

  it('leaves paths that already name a version untouched', () => {
    expect(UnversionedApiAliasMiddleware.rewrite('/api/v1/users')).toBe('/api/v1/users');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/v2/users')).toBe('/api/v2/users');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/v1')).toBe('/api/v1');
  });

  it('leaves the unversioned probes alone (/api/ready has no versioned twin)', () => {
    expect(UnversionedApiAliasMiddleware.rewrite('/api/health')).toBe('/api/health');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/ready')).toBe('/api/ready');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/ready?x=1')).toBe('/api/ready?x=1');
    expect(UnversionedApiAliasMiddleware.rewrite('/api/readyz')).toBe('/api/v1/readyz');
  });

  it('leaves non-api paths untouched', () => {
    for (const url of ['/uploads/a.png', '/health', '/apiary', '/robots.txt', '/']) {
      expect(UnversionedApiAliasMiddleware.rewrite(url)).toBe(url);
    }
  });

  it('does not mistake a resource starting with v for a version', () => {
    expect(UnversionedApiAliasMiddleware.rewrite('/api/videos/1')).toBe('/api/v1/videos/1');
  });

  it('rewrites url and originalUrl before calling next', () => {
    const req: any = { url: '/api/users', originalUrl: '/api/users' };
    const next = vi.fn();
    new UnversionedApiAliasMiddleware().middleware()(req, {} as any, next);
    expect(req.url).toBe('/api/v1/users');
    expect(req.originalUrl).toBe('/api/v1/users');
    expect(next).toHaveBeenCalledOnce();
  });

  it('serves a router mounted at the versioned prefix through both paths', async () => {
    const express = (await import('express')).default;
    const app = express();
    app.use(new UnversionedApiAliasMiddleware().middleware());
    const seen: string[] = [];
    app.use('/api/', (req, _res, next) => { seen.push(req.originalUrl); next(); });
    const v1 = express.Router();
    v1.get('/auth/sso/:provider/callback', (req, res) => { res.json({ provider: req.params.provider, code: req.query.code }); });
    app.use('/api/v1', v1);
    const server = app.listen(0);
    const port = (server.address() as any).port;
    try {
      for (const path of ['/api/v1/auth/sso/google/callback?code=a', '/api/auth/sso/google/callback?code=a']) {
        const res = await fetch(`http://127.0.0.1:${port}${path}`);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ provider: 'google', code: 'a' });
      }
      expect(seen).toEqual(['/api/v1/auth/sso/google/callback?code=a', '/api/v1/auth/sso/google/callback?code=a']);
    } finally {
      server.close();
    }
  });
});
