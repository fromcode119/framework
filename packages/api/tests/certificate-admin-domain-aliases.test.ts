import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcmeSettings, ApplicationUrlUtils, TenantRecord } from '@fromcode119/core';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';

/**
 * Settings → General → Domain aliases on an install with no sites are routed to the storefront, so
 * the certificates screen must list them — a routed name with no certificate refuses every visitor.
 */
const service = (tenants: TenantRecord[], aliases: string[]): CertificateAdminService =>
  new CertificateAdminService(
    { list: async () => [] } as never,
    { list: async () => tenants } as never,
    { readCiphertext: async () => '' } as never,
    { notify: async () => undefined } as never,
    { read: async () => ({ tls: true }) } as never,
    new Map([['domain_aliases', JSON.stringify(aliases)]]),
  );

const hostsOf = (result: Record<string, unknown>) =>
  (result.hosts as Array<Record<string, unknown>>).map((h) => ({ host: h.host, role: h.role }));

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('CertificateAdminService — single-site domain aliases', () => {
  const setup = () => {
    vi.spyOn(AcmeSettings, 'load').mockResolvedValue({ isConfigured: true, missingReason: '', toJson: () => ({}) } as never);
    ApplicationUrlUtils.registerAppUrlSettingsReader((app) => (app === ApplicationUrlUtils.FRONTEND_APP ? 'https://shop.example.com' : null));
  };

  it('lists each alias as an alias host', async () => {
    setup();
    const rows = hostsOf(await service([], ['example.com', 'www.example.com', 'shop.example.com']).overview());
    expect(rows.find((r) => r.host === 'example.com')?.role).toBe('alias');
    expect(rows.find((r) => r.host === 'www.example.com')?.role).toBe('alias');
    expect(rows.filter((r) => r.host === 'shop.example.com')).toHaveLength(1);
  });

  it('ignores the aliases once the install serves sites', async () => {
    setup();
    const site = TenantRecord.from({ id: 's', slug: 's', primary_host: 's.example.com', host_aliases: '[]', state: 'active', visibility: 'public' });
    const rows = hostsOf(await service([site], ['example.com']).overview());
    expect(rows.map((r) => r.host)).not.toContain('example.com');
  });
});
