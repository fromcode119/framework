import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegacyApiPathUsage } from '@api/middlewares/legacy-api-path-usage';
import { UnversionedApiAliasMiddleware } from '@api/middlewares/unversioned-api-alias-middleware';

describe('LegacyApiPathUsage', () => {
  afterEach(() => { LegacyApiPathUsage.flush(); vi.unstubAllEnvs(); });

  it('keeps the path shape and drops ids, tokens and query strings', () => {
    expect(LegacyApiPathUsage.shape('/api/v1/plugins/box/share/3f9ab2c4d5e6f708a9b0c1d2e3f4a5b6c7d8e9f0?x=1'))
      .toBe('/api/v1/plugins/box/share/:id');
    expect(LegacyApiPathUsage.shape('/api/v1/orders/764')).toBe('/api/v1/orders/:id');
    expect(LegacyApiPathUsage.shape('/api/v1/auth/sso/google/callback?code=secret&state=s')).toBe('/api/v1/auth/sso/google/callback');
  });

  it('names the client by its product token', () => {
    expect(LegacyApiPathUsage.client('PaymentsHook/1.0 (+https://example.com/hooks)')).toBe('PaymentsHook/1.0');
    expect(LegacyApiPathUsage.client('okhttp/4.12.0')).toBe('okhttp/4.12.0');
    expect(LegacyApiPathUsage.client('Mozilla/5.0 (Macintosh) AppleWebKit Chrome/130 Safari/537')).toBe('browser');
    expect(LegacyApiPathUsage.client('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('Googlebot');
    expect(LegacyApiPathUsage.client(undefined)).toBe('none');
  });

  it('writes one line per caller with its count, then starts over', () => {
    LegacyApiPathUsage.record('get', '/api/v1/auth/sso/google/callback?code=a', 'Mozilla/5.0 Chrome', 'https://accounts.google.com/');
    LegacyApiPathUsage.record('GET', '/api/v1/auth/sso/google/callback?code=b', 'Mozilla/5.0 Chrome', 'https://accounts.google.com/x');
    LegacyApiPathUsage.record('POST', '/api/v1/plugins/box/webhooks/payments', 'PaymentsHook/1.0', undefined);
    expect(LegacyApiPathUsage.flush()).toEqual([
      '2x GET /api/v1/auth/sso/google/callback client=browser from=accounts.google.com',
      '1x POST /api/v1/plugins/box/webhooks/payments client=PaymentsHook/1.0 from=none',
    ]);
    expect(LegacyApiPathUsage.flush()).toEqual([]);
  });

  it('is fed by the alias for legacy requests only', () => {
    const run = (url: string) => new UnversionedApiAliasMiddleware().middleware()({ method: 'GET', url, originalUrl: url, headers: { 'user-agent': 'okhttp/4' } } as any, {} as any, () => undefined);
    run('/api/v1/users');
    run('/api/users');
    expect(LegacyApiPathUsage.flush()).toEqual(['1x GET /api/v1/users client=okhttp/4 from=none']);
  });

  it('records nothing when a version is configured (the bare form is then the alias)', () => {
    vi.stubEnv('API_VERSION_PREFIX', 'v1');
    new UnversionedApiAliasMiddleware().middleware()({ method: 'GET', url: '/api/users', originalUrl: '/api/users', headers: {} } as any, {} as any, () => undefined);
    expect(LegacyApiPathUsage.flush()).toEqual([]);
  });
});
