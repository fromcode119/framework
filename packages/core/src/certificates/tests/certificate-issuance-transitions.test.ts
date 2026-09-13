import { beforeEach, describe, expect, it } from 'vitest';
import { CertificateIssuanceBackoff } from '@core/certificates/acme/certificate-issuance-backoff';
import { CertificateState } from '@core/enums/certificate-state.enum';
import { CertificateStoreService } from '@core/certificates/certificate-store-service';

/**
 * The writes an issuance attempt makes, and — more importantly — the ones it does not.
 *
 * Two invariants here are load-bearing and invisible if broken: a failed renewal must not remove the
 * certificate that is still serving, and a failure that never reached the certificate authority must
 * not spend the counter that rations attempts against it.
 */
describe('Issuance transitions', () => {
  let rows: Array<Record<string, any>>;
  let store: CertificateStoreService;

  /** The raw-manager surface, with UPDATE returning falsy when the WHERE matches nothing. */
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
  }

  const seed = (overrides: Record<string, any> = {}): void => {
    rows.length = 0;
    rows.push({
      host: 'shop.test', tenant_id: 't1', source: 'automatic', state: 'waiting_for_dns',
      certificate_pem: '', private_key_enc: '', attempts_in_window: 0,
      last_error: '', last_warned_days: null, ...overrides,
    });
  };

  beforeEach(() => {
    rows = [];
    store = new CertificateStoreService(new FakeDb(rows));
    process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key-for-issuance';
  });

  it('claims a host for one attempt and marks it in flight', async () => {
    seed();
    const claimed = await store.claimForIssuance('shop.test', CertificateState.WAITING_FOR_DNS);
    expect(claimed).not.toBeNull();
    expect(rows[0].state).toBe('issuing');
    expect(rows[0].last_attempt_at).toBeInstanceOf(Date);
  });

  it('REFUSES a second claim — two sweeps must not both order the same certificate', async () => {
    seed();
    const first = await store.claimForIssuance('shop.test', CertificateState.WAITING_FOR_DNS);
    const second = await store.claimForIssuance('shop.test', CertificateState.WAITING_FOR_DNS);

    expect(first).not.toBeNull();
    // The state moved under it, so the WHERE no longer matches: one winner, one null.
    expect(second).toBeNull();
  });

  it('refuses a claim whose expected state is stale', async () => {
    seed({ state: 'failed' });
    expect(await store.claimForIssuance('shop.test', CertificateState.WAITING_FOR_DNS)).toBeNull();
  });

  it('waiting-for-DNS does NOT spend the authority counter — it never reached one', async () => {
    seed({ attempts_in_window: 3 });
    await store.markWaitingForDns('shop.test', 'Does not resolve yet', CertificateIssuanceBackoff.after(300000));

    expect(rows[0].state).toBe('waiting_for_dns');
    expect(rows[0].attempts_in_window).toBe(3);
    expect(rows[0].last_error).toContain('Does not resolve yet');
  });

  it('a failed attempt keeps the certificate that is still serving', async () => {
    seed({ state: 'serving', certificate_pem: 'CERT', private_key_enc: 'enc:v1:KEY', attempts_in_window: 0 });
    await store.recordFailure('shop.test', 'urn:ietf:params:acme:error:rateLimited', 1, CertificateIssuanceBackoff.nextAttemptAfter(1));

    // The visitor keeps a working site while the renewal is retried — edgeBundle selects on material.
    expect(rows[0].certificate_pem).toBe('CERT');
    expect(rows[0].private_key_enc).toBe('enc:v1:KEY');
    expect(rows[0].state).toBe('failed');
    expect(rows[0].attempts_in_window).toBe(1);
  });

  it('stores the authority\'s own words, not a paraphrase', async () => {
    seed();
    const detail = 'urn:ietf:params:acme:error:caa :: CAA record forbids issuance';
    await store.recordFailure('shop.test', detail, 1, new Date());
    expect(rows[0].last_error).toBe(detail);
  });

  it('a successful issuance clears the error, the backoff and the warning marker', async () => {
    seed({ state: 'issuing', attempts_in_window: 4, last_error: 'previously broken', last_warned_days: 7 });
    const material = {
      certificatePem: '-----BEGIN CERTIFICATE-----x', privateKeyPem: '-----BEGIN PRIVATE KEY-----y',
      issuer: "CN=Let's Encrypt", subjectAltNames: ['shop.test'], serial: '01', fingerprintSha256: 'AA:BB',
      notBefore: new Date(), notAfter: new Date(Date.now() + 90 * 86_400_000),
    } as any;

    await store.storeIssued('shop.test', 't1', material);

    expect(rows[0].state).toBe('serving');
    expect(rows[0].source).toBe('automatic');
    expect(rows[0].last_error).toBe('');
    expect(rows[0].next_attempt_at).toBeNull();
    expect(rows[0].attempts_in_window).toBe(0);
    expect(rows[0].last_warned_days).toBeNull();
    // Stored encrypted, like every other key.
    expect(String(rows[0].private_key_enc).startsWith('enc:v1:')).toBe(true);
  });
});
