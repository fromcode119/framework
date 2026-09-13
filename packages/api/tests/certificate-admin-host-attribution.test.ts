import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcmeSettings, TenantRecord } from '@fromcode119/core';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';

/**
 * WHOSE host is this? The Domains tab on a site filters this list by tenant, so a host attributed to
 * nobody is a host that site cannot see — and the screen then says it has no addresses at all while
 * plainly serving on one.
 */
const tenant = (slug: string, primaryHost: string, aliases: string[] = []): TenantRecord => TenantRecord.from({
  id: slug, slug, primary_host: primaryHost, host_aliases: JSON.stringify(aliases), state: 'active', visibility: 'public',
});

const service = (tenants: TenantRecord[]): CertificateAdminService => new CertificateAdminService(
  { list: async () => [] } as never,
  { list: async () => tenants } as never,
  { notify: async () => undefined } as never,
  { read: async () => ({ tls: false }) } as never,
);

const hostsOf = async (result: Record<string, unknown>) =>
  (result.hosts as Array<Record<string, unknown>>).map((h) => ({ host: h.host, tenantId: h.tenantId, role: h.role }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CertificateAdminService host attribution', () => {
  const stubAcme = () => vi.spyOn(AcmeSettings, 'load').mockResolvedValue({
    isConfigured: false,
    missingReason: 'No certificate authority is declared.',
    toJson: () => ({}),
  } as never);

  it('attributes a host to its SITE even when a platform URL names the same host', async () => {
    // A single-site deployment looks exactly like this: FRONTEND_URL is the site's own address.
    // The platform pass used to claim it first with no tenant, and the site's Domains tab — which
    // filters by tenant — then reported that the site had no hosts at all.
    stubAcme();
    vi.stubEnv('FRONTEND_URL', 'https://acme.example.com');
    vi.stubEnv('ADMIN_URL', 'https://console.example.com');
    vi.stubEnv('API_URL', 'https://api.example.com');

    const acme = await service([tenant('acme', 'acme.example.com')]).forTenant('acme');

    expect(await hostsOf(acme)).toEqual([
      { host: 'acme.example.com', tenantId: 'acme', role: 'primary' },
    ]);
  });

  it('still lists a platform host that belongs to no site', async () => {
    stubAcme();
    vi.stubEnv('FRONTEND_URL', '');
    vi.stubEnv('ADMIN_URL', 'https://console.example.com');
    vi.stubEnv('API_URL', '');

    const all = await service([tenant('acme', 'acme.example.com')]).overview();
    const hosts = await hostsOf(all);

    expect(hosts).toContainEqual({ host: 'console.example.com', tenantId: null, role: 'platform_admin' });
    expect(hosts).toContainEqual({ host: 'acme.example.com', tenantId: 'acme', role: 'primary' });
  });

  it('keeps aliases with their site, and never invents a host from an unconfigured URL', async () => {
    stubAcme();
    vi.stubEnv('FRONTEND_URL', '');
    vi.stubEnv('ADMIN_URL', '');
    vi.stubEnv('API_URL', '');

    const hosts = await hostsOf(await service([tenant('acme', 'acme.example.com', ['www.acme.example.com'])]).overview());

    // Exactly the two the site declares — an unconfigured app URL contributes nothing rather than a
    // guessed hostname.
    expect(hosts).toEqual([
      { host: 'acme.example.com', tenantId: 'acme', role: 'primary' },
      { host: 'www.acme.example.com', tenantId: 'acme', role: 'alias' },
    ]);
  });
});
