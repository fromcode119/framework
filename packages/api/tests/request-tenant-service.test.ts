import { describe, expect, it } from 'vitest';
import { RequestTenantService } from '@api/services/request/request-tenant-service';
import { ServerMiddlewareSetup } from '@api/server/server-middleware-setup';

describe('RequestTenantService.hostCandidates', () => {
  it('uses x-forwarded-host when the edge set it — the internal Host is then the service name, not a site', () => {
    expect(RequestTenantService.hostCandidates({ headers: { 'x-forwarded-host': 'acme.test:443', host: 'api:3000' } }))
      .toEqual(['acme.test']);
  });

  it('uses Host when nothing was forwarded', () => {
    expect(RequestTenantService.hostCandidates({ headers: { host: 'acme.test:443' } })).toEqual(['acme.test']);
  });

  it("falls back to the browser's Origin host when the Host is the shared api host", () => {
    // The storefront's client boots against api.framework.local — nobody's site. Origin names the site.
    expect(RequestTenantService.hostCandidates({ headers: { host: 'api.framework.local', origin: 'http://acme.framework.local' } }))
      .toEqual(['api.framework.local', 'acme.framework.local']);
  });

  it('uses Referer when there is no Origin', () => {
    expect(RequestTenantService.hostCandidates({ headers: { host: 'api.framework.local', referer: 'https://globex.framework.local/shop?x=1' } }))
      .toEqual(['api.framework.local', 'globex.framework.local']);
  });

  it('ignores a malformed Origin and never yields an empty candidate', () => {
    expect(RequestTenantService.hostCandidates({ headers: { host: 'api', origin: 'not a url' } })).toEqual(['api']);
    expect(RequestTenantService.hostCandidates({ headers: {} })).toEqual([]);
  });

  it('de-duplicates when Origin and Host agree', () => {
    expect(RequestTenantService.hostCandidates({ headers: { host: 'acme.test', origin: 'http://acme.test' } })).toEqual(['acme.test']);
  });
});

describe('ServerMiddlewareSetup.isPublicAssetRoute', () => {
  const isAsset = (path: string) => (ServerMiddlewareSetup.prototype as any).isPublicAssetRoute.call({}, { path });

  it('exempts theme ui/public files and plugin ui files', () => {
    expect(isAsset('/api/v1/themes/fromcode/ui/bundle.js')).toBe(true);
    expect(isAsset('/api/v1/themes/fromcode/ui/fonts/ibm-plex-sans-400.woff2')).toBe(true);
    expect(isAsset('/api/v1/themes/fromcode/public/logo.svg')).toBe(true);
    expect(isAsset('/api/v1/plugins/seo/ui/bundle.js')).toBe(true);
  });

  it('exempts NOTHING that can return a row', () => {
    expect(isAsset('/api/v1/themes')).toBe(false);
    expect(isAsset('/api/v1/themes/fromcode/activate')).toBe(false);
    expect(isAsset('/api/v1/plugins/seo/settings')).toBe(false);
    expect(isAsset('/api/v1/plugins/seo/health')).toBe(false);
    expect(isAsset('/api/v1/system/frontend')).toBe(false);
    expect(isAsset('/api/v1/media/ui/x')).toBe(false);
  });
});
