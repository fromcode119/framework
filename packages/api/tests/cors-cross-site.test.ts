import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantResolverService } from '@fromcode119/core';
import { ServerCorsSetup } from '@api/server/server-cors-setup';

/**
 * One site's page may not call ANOTHER site's host with credentials.
 *
 * Every active site is on the credentialed allow-list, because its pages call the shared api host. That
 * also granted a page on site B a credentialed channel into site A's own host — and where sites share a
 * parent domain they share the storefront cookie and its readable CSRF cookie, so B's scripts could act
 * as A's signed-in customer.
 */
describe('ServerCorsSetup cross-site', () => {
  afterEach(() => vi.restoreAllMocks());

  const hosts: Record<string, { id: string }> = {
    'acme.fromcode.test': { id: 'acme' },
    'api.acme.fromcode.test': { id: 'acme' },
    'globex.fromcode.test': { id: 'globex' },
  };
  const setup = () => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({ resolveByHost: async (host: string) => hosts[host] ?? null } as any);
    return new ServerCorsSetup({} as any, new Map(), { error: vi.fn(), warn: vi.fn() } as any, {});
  };
  const crossSite = (origin: string, host: string) => (setup() as any).crossSite(origin, { headers: { host } });

  it('refuses a site calling another site\'s host', async () => {
    await expect(crossSite('https://globex.fromcode.test', 'acme.fromcode.test')).resolves.toBe(true);
  });

  it('allows a site calling its own api alias', async () => {
    await expect(crossSite('https://acme.fromcode.test', 'api.acme.fromcode.test')).resolves.toBe(false);
  });

  it('allows any site calling the SHARED api host, where the origin names the site', async () => {
    await expect(crossSite('https://globex.fromcode.test', 'api.fromcode.test')).resolves.toBe(false);
  });

  it('allows a non-site origin (the console) — the allow-list decides that one', async () => {
    await expect(crossSite('https://admin.fromcode.test', 'acme.fromcode.test')).resolves.toBe(false);
  });

  it('fails closed when the host map cannot be read', async () => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({ resolveByHost: async () => { throw new Error('db down'); } } as any);
    const cors = new ServerCorsSetup({} as any, new Map(), { error: vi.fn(), warn: vi.fn() } as any, {});
    await expect((cors as any).crossSite('https://globex.fromcode.test', { headers: { host: 'acme.fromcode.test' } })).resolves.toBe(true);
  });
});
