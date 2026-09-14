import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';

/**
 * This base is baked into server-rendered HTML — the theme bundle, `@font-face src:url(...)`, resized
 * images — so it must be an address the VISITOR's browser can reach, or empty.
 *
 * It used to read `API_URL` as well and fall back to a localhost base. Both name this SERVER: inside a
 * container `API_URL` is `http://api:3000`, so a deployment that configured no public URL emitted
 * `http://api:3000/api/v1/themes/<t>/ui/bundle.js` and `src:url(http://api:3000/.../font.woff)` into
 * the page. The theme never loaded and the fonts never resolved, with nothing in the log to say why.
 */
describe('ServerApiPaths.buildPublicApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the PUBLIC url when the deployment has one', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');

    expect(ServerApiPaths.buildPublicApiBaseUrl()).toBe('https://api.example.com');
  });

  it('is EMPTY when none is configured, so the paths come out relative', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');

    expect(ServerApiPaths.buildPublicApiBaseUrl()).toBe('');
  });

  it('never falls back to a server-side address the browser cannot reach', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    // The internal container address, and the localhost base that used to be the fallback.
    vi.stubEnv('API_URL', 'http://api:3000');

    const base = ServerApiPaths.buildPublicApiBaseUrl();

    expect(base).not.toContain('api:3000');
    expect(base).not.toContain('localhost');
    expect(base).toBe('');
  });
});
