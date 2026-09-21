import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcmeSettings, CertificateRecord, TenantRecord } from '@fromcode119/core';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';

/**
 * The screen must not say a host is unprotected while the gateway is serving it.
 *
 * A wildcard is stored against the name it was ordered for, so `*.example.com` lives on the
 * `example.com` row. The gateway resolves that at handshake time; the admin read only each host's
 * OWN row, so every covered subdomain reported "Nothing stored — this host cannot be served over
 * HTTPS by this platform" while HTTPS worked perfectly. Wrong in the dangerous direction: it invites
 * a second certificate for a name that already has one, and teaches the operator to distrust the page.
 *
 * Both layers now share `WildcardHostCoverage`, so they cannot drift apart.
 */
const tenant = (slug: string, primaryHost: string, aliases: string[] = []): TenantRecord => TenantRecord.from({
  id: slug, slug, primary_host: primaryHost, host_aliases: JSON.stringify(aliases), state: 'active', visibility: 'public',
});

const cert = (host: string, over: Record<string, unknown> = {}) => CertificateRecord.from({
  host,
  tenant_id: null,
  source: 'automatic',
  state: 'serving',
  challenge: 'dns-01',
  wildcard: true,
  certificate_pem: '-----BEGIN CERTIFICATE-----x-----END CERTIFICATE-----',
  private_key_enc: 'enc:v1:x',
  not_after: new Date('2026-12-20T10:26:55Z'),
  attempts_in_window: 0,
  ...over,
});

const service = (tenants: TenantRecord[], stored: unknown[]): CertificateAdminService =>
  new CertificateAdminService(
    { list: async () => stored } as never,
    { list: async () => tenants } as never,
    { readCiphertext: async () => '' } as never,
    { notify: async () => undefined } as never,
    { read: async () => ({ tls: true }) } as never,
  );

const row = async (svc: CertificateAdminService, host: string) => {
  const result = await svc.overview();
  return (result.hosts as Array<Record<string, unknown>>).find((h) => h.host === host);
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CertificateAdminService — a host covered by a wildcard is shown as covered', () => {
  const stubAcme = () => vi.spyOn(AcmeSettings, 'load').mockResolvedValue({
    isConfigured: true, missingReason: '', toJson: () => ({}),
  } as never);

  it('names the wildcard that covers a subdomain', async () => {
    stubAcme();
    const svc = service([tenant('shop', 'shop.example.com')], [cert('example.com')]);

    const found = await row(svc, 'shop.example.com');
    expect(found?.coveredByHost).toBe('example.com');
    expect(found?.state).toBe('serving');
  });

  it('carries the cover\'s expiry, so the row can say until when', async () => {
    stubAcme();
    const svc = service([tenant('shop', 'shop.example.com')], [cert('example.com')]);

    const found = await row(svc, 'shop.example.com');
    expect(String(found?.coveredByNotAfter)).toContain('2026-12-20');
    expect(found?.daysRemaining).not.toBeNull();
  });

  it('prefers the host\'s OWN certificate over a wildcard that would also cover it', async () => {
    stubAcme();
    const svc = service(
      [tenant('shop', 'shop.example.com')],
      [cert('example.com'), cert('shop.example.com', { wildcard: false })],
    );

    const found = await row(svc, 'shop.example.com');
    expect(found?.coveredByHost).toBeNull();
    expect(found?.certificate).not.toBeNull();
  });

  /** A NON-wildcard certificate on the parent covers nothing. */
  it('does not claim coverage from a non-wildcard parent', async () => {
    stubAcme();
    const svc = service([tenant('shop', 'shop.example.com')], [cert('example.com', { wildcard: false })]);

    expect((await row(svc, 'shop.example.com'))?.coveredByHost).toBeNull();
  });

  /** A wildcard still being ORDERED serves nothing yet, so it must not be reported as cover. */
  it('does not claim coverage from a wildcard that has no material yet', async () => {
    stubAcme();
    const svc = service(
      [tenant('shop', 'shop.example.com')],
      [cert('example.com', { state: 'issuing', certificate_pem: '', private_key_enc: '', not_after: null })],
    );

    const found = await row(svc, 'shop.example.com');
    expect(found?.coveredByHost).toBeNull();
    expect(found?.state).toBe('no_certificate');
  });

  it('does not reach two labels up', async () => {
    stubAcme();
    const svc = service([tenant('deep', 'a.b.example.com')], [cert('example.com')]);

    expect((await row(svc, 'a.b.example.com'))?.coveredByHost).toBeNull();
  });
});
