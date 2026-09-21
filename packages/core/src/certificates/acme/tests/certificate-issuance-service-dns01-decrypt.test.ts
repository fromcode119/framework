import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AcmeAccountStore } from '@core/certificates/acme/acme-account-store';
import { AcmeChallengeStore } from '@core/certificates/acme/acme-challenge-store';
import { AcmeCloudflareTokenStore } from '@core/certificates/acme/dns/acme-cloudflare-token-store';
import { AcmeDnsTokenResolver } from '@core/certificates/acme/dns/acme-dns-token-resolver';
import { CertificateIssuanceService } from '@core/certificates/acme/certificate-issuance-service';
import { CertificateStoreService } from '@core/certificates/certificate-store-service';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * A rotated/removed SECRET_KEY must not leave a DNS-01 host stuck silently.
 *
 * `isCloudflareConfigured` only proves ciphertext EXISTS — it never decrypts. So a host can sail
 * past that check and then hit `settings.cloudflareToken` (the actual decrypt) inside
 * `attemptDns01`. Before the fix under test, that throw escaped `attemptDns01` uncaught, skipped
 * `recordFailure` entirely, and left the host with no `lastError`/`nextAttemptAt` — perpetually
 * "due" and burning a `MAX_ORDERS_PER_SWEEP` slot every sweep with nothing shown in the admin.
 */
describe('CertificateIssuanceService — attemptDns01 survives an undecryptable Cloudflare token', () => {
  let rows: Array<Record<string, any>>;
  let meta: Array<Record<string, any>>;

  /** Same minimal raw-manager fake used by the other issuance transition tests. */
  class FakeDb {
    constructor(private readonly table: Array<Record<string, any>>) {}
    async find(): Promise<Array<Record<string, any>>> { return [...this.table]; }
    async findOne(_n: string, where: Record<string, any>): Promise<Record<string, any> | null> {
      return this.table.find((row) => Object.entries(where).every(([k, v]) => row[k] === v)) ?? null;
    }
    async insert(_n: string, values: Record<string, any>): Promise<void> { this.table.push({ ...values }); }
    async update(_n: string, where: Record<string, any>, values: Record<string, any>): Promise<unknown> {
      const row = this.table.find((candidate) => Object.entries(where).every(([k, v]) => candidate[k] === v));
      if (!row) return null;
      Object.assign(row, values);
      return row;
    }
    async delete(): Promise<void> { /* unused here */ }
    async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
    async withTenant<T>(_tenantId: string, fn: () => Promise<T>): Promise<T> { return fn(); }
  }

  /** The token now comes from the scoped store, not from platform settings. */
  const resolver = () => new AcmeDnsTokenResolver(new AcmeCloudflareTokenStore(new FakeDb(meta)));

  beforeEach(() => {
    rows = [];
    meta = [{
      key: SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN,
      tenant_id: null,
      value: 'enc:v1:garbage',
    }];
    rows.push({
      host: 'shop.test', tenant_id: 't1', source: 'automatic', state: 'waiting_for_dns',
      challenge: 'dns-01', wildcard: true,
      certificate_pem: '', private_key_enc: '', attempts_in_window: 0,
      last_error: '', last_warned_days: null, next_attempt_at: null,
    });
    process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key-for-issuance';

    // A declared, complete authority config, plus a Cloudflare token ciphertext that is well-formed
    // but decrypts to garbage — exactly what a rotated SECRET_KEY produces in production.
    PlatformSettingsService.registerAccessor(async (key: string) => {
      const values: Record<string, string> = {
        [SystemConstants.META_KEY.CERTIFICATE_ACME_DIRECTORY]: 'https://acme.example/directory',
        [SystemConstants.META_KEY.CERTIFICATE_PLATFORM_ADDRESSES]: '203.0.113.10',
        [SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN]: 'enc:v1:garbage',
      };
      return values[key] ?? null;
    });
  });

  afterEach(() => {
    PlatformSettingsService.registerAccessor(null as any);
  });

  it('calls recordFailure with a message distinguishing "cannot decrypt" from "not configured"', async () => {
    const store = new CertificateStoreService(new FakeDb(rows));
    const service = new CertificateIssuanceService(
      store,
      new AcmeAccountStore(new FakeDb([])),
      new AcmeChallengeStore(new FakeDb([])),
      resolver(),
    );

    await service.sweep();

    expect(rows[0].state).toBe('failed');
    expect(rows[0].last_error).toContain('SECRET_KEY');
    expect(rows[0].last_error).not.toContain('No Cloudflare API token is configured');
    // recordFailure must actually have set a retry so the host is not "due" again on the next sweep.
    expect(rows[0].next_attempt_at).toBeInstanceOf(Date);
    expect((rows[0].next_attempt_at as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('is distinct from the "no token configured" message when there is truly no ciphertext', async () => {
    meta = [];
    PlatformSettingsService.registerAccessor(async (key: string) => {
      const values: Record<string, string> = {
        [SystemConstants.META_KEY.CERTIFICATE_ACME_DIRECTORY]: 'https://acme.example/directory',
        [SystemConstants.META_KEY.CERTIFICATE_PLATFORM_ADDRESSES]: '203.0.113.10',
      };
      return values[key] ?? null;
    });

    const store = new CertificateStoreService(new FakeDb(rows));
    const service = new CertificateIssuanceService(
      store,
      new AcmeAccountStore(new FakeDb([])),
      new AcmeChallengeStore(new FakeDb([])),
      resolver(),
    );

    await service.sweep();

    expect(rows[0].state).toBe('failed');
    expect(rows[0].last_error).toContain('No Cloudflare API token is configured');
    expect(rows[0].last_error).not.toContain('SECRET_KEY');
  });
});
