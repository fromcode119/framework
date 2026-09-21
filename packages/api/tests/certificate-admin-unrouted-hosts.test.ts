import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcmeSettings, CertificateRecord, TenantRecord } from '@fromcode119/core';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';

/**
 * A certificate the platform holds must be visible, even for a host it does not route.
 *
 * The list is built from SERVED hosts, so a stored certificate for anything else was dropped from
 * it entirely: held on disk, renewing itself on a schedule, carrying a private key, and shown on no
 * screen — with no way to remove it short of a database row. A key the operator cannot point at is
 * precisely what this platform does not allow.
 *
 * It is not hypothetical. A wildcard is stored against the name it was ordered for, so
 * `*.example.com` lives under `example.com` — a name the platform may hold a certificate for while
 * serving only its subdomains. Removing a domain from a site strands one the same way.
 */
const tenant = (slug: string, primaryHost: string, aliases: string[] = []): TenantRecord => TenantRecord.from({
  id: slug, slug, primary_host: primaryHost, host_aliases: JSON.stringify(aliases), state: 'active', visibility: 'public',
});

const record = (host: string, tenantId: string | null = null) => CertificateRecord.from({
  host,
  tenant_id: tenantId,
  source: 'automatic',
  state: 'serving',
  challenge: 'dns-01',
  wildcard: true,
  certificate_pem: '-----BEGIN CERTIFICATE-----x-----END CERTIFICATE-----',
  private_key_enc: 'enc:v1:x',
  not_after: new Date(Date.now() + 30 * 86_400_000),
  attempts_in_window: 0,
});

const service = (tenants: TenantRecord[], stored: Array<Record<string, unknown>>): CertificateAdminService =>
  new CertificateAdminService(
    { list: async () => stored } as never,
    { list: async () => tenants } as never,
    { readCiphertext: async () => '' } as never,
    { notify: async () => undefined } as never,
    { read: async () => ({ tls: true }) } as never,
  );

const hostsOf = (result: Record<string, unknown>) =>
  (result.hosts as Array<Record<string, unknown>>).map((h) => ({ host: h.host, role: h.role }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CertificateAdminService — certificates for hosts the platform does not route', () => {
  const stubAcme = () => vi.spyOn(AcmeSettings, 'load').mockResolvedValue({
    isConfigured: true,
    missingReason: '',
    toJson: () => ({}),
  } as never);

  it('lists a stored certificate whose host is not served', async () => {
    stubAcme();
    const result = await service([tenant('shop', 'shop.example.com')], [record('example.com')]).overview();

    const rows = hostsOf(result);
    expect(rows.map((r) => r.host)).toContain('example.com');
    expect(rows.find((r) => r.host === 'example.com')?.role).toBe('unrouted');
  });

  it('still lists the served hosts, with their real roles', async () => {
    stubAcme();
    const result = await service([tenant('shop', 'shop.example.com')], [record('example.com')]).overview();

    const rows = hostsOf(result);
    expect(rows.find((r) => r.host === 'shop.example.com')?.role).toBe('primary');
  });

  it('does not mark a served host as unrouted just because it has a certificate', async () => {
    stubAcme();
    const result = await service([tenant('shop', 'shop.example.com')], [record('shop.example.com', 'shop')]).overview();

    const rows = hostsOf(result);
    expect(rows.filter((r) => r.role === 'unrouted')).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });

  it('carries the owning site through, so a site-scoped read can still find it', async () => {
    stubAcme();
    const result = await service([tenant('shop', 'shop.example.com')], [record('old.example.com', 'shop')]).forTenant('shop');

    expect(hostsOf(result).map((r) => r.host)).toContain('old.example.com');
  });

  it('an unrouted host is NOT treated as one of the platform\'s own', async () => {
    stubAcme();
    const result = await service([], [record('example.com')]).overview();

    const rows = result.hosts as Array<Record<string, unknown>>;
    expect(rows.find((r) => r.host === 'example.com')?.isPlatformHost).toBe(false);
  });
});
