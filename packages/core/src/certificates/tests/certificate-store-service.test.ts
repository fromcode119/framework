import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CertificateRecord } from '@core/certificates/certificate-record';
import { CertificateRejection } from '@core/enums/certificate-rejection.enum';
import { CertificateSource } from '@core/enums/certificate-source.enum';
import { CertificateState } from '@core/enums/certificate-state.enum';
import { CertificateStoreService } from '@core/certificates/certificate-store-service';
import { CertificateValidationError } from '@core/certificates/certificate-validation-error';

/**
 * The store, and the promise that matters most: a private key is never at rest in the clear and
 * never reaches the admin.
 *
 * Both are invisible failures. A key written unencrypted looks identical from every screen in the
 * product, and a key leaking through an admin response is only ever noticed by whoever reads the
 * response. So they are asserted here rather than trusted.
 */
describe('CertificateStoreService', () => {
  let dir = '';
  let store: CertificateStoreService;
  let rows: Array<Record<string, any>>;
  const read = (name: string): string => readFileSync(join(dir, name), 'utf8');

  /** The raw-manager surface this service uses, in memory. */
  class FakeDb {
    constructor(private readonly table: Array<Record<string, any>>) {}
    async find(_name: string): Promise<Array<Record<string, any>>> { return [...this.table]; }
    async findOne(_name: string, where: Record<string, any>): Promise<Record<string, any> | null> {
      return this.table.find((row) => row.host === where.host) ?? null;
    }
    async insert(_name: string, values: Record<string, any>): Promise<void> { this.table.push({ ...values }); }
    async update(_name: string, where: Record<string, any>, values: Record<string, any>): Promise<void> {
      const row = this.table.find((candidate) => candidate.host === where.host);
      if (row) Object.assign(row, values);
    }
    async delete(_name: string, where: Record<string, any>): Promise<void> {
      const index = this.table.findIndex((row) => row.host === where.host);
      if (index >= 0) this.table.splice(index, 1);
    }
  }

  beforeAll(() => {
    execFileSync('openssl', ['version'], { stdio: 'pipe' });
    dir = mkdtempSync(join(tmpdir(), 'fc-store-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'good.key',
      '-out', 'good.crt', '-days', '400', '-subj', '/CN=site.test',
      '-addext', 'subjectAltName=DNS:site.test'], { cwd: dir, stdio: 'pipe' });
    execFileSync('openssl', ['genrsa', '-out', 'other.key', '2048'], { cwd: dir, stdio: 'pipe' });
    // The service refuses to touch a key at all without this; the round trip is the point of the suite.
    process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key-for-certificate-store';
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const freshStore = (): CertificateStoreService => {
    rows = [];
    store = new CertificateStoreService(new FakeDb(rows));
    return store;
  };

  it('stores the private key ENCRYPTED, and the raw key never appears in the row', async () => {
    await freshStore().upload({ host: 'site.test', tenantId: 'acme', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });

    const row = rows[0];
    expect(row.private_key_enc.startsWith('enc:v1:')).toBe(true);
    expect(row.private_key_enc).not.toContain('BEGIN');
    expect(JSON.stringify(row)).not.toContain('BEGIN PRIVATE KEY');
    // The certificate itself is public — every visitor is handed it — so it is stored readable.
    expect(row.certificate_pem).toContain('BEGIN CERTIFICATE');
  });

  it('never lets a private key out through the admin projection', async () => {
    const record = await freshStore().upload({ host: 'site.test', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });
    const json = record.toAdminJson();

    expect(Object.keys(json)).not.toContain('privateKeyPem');
    expect(Object.keys(json)).not.toContain('privateKeyEnc');
    expect(JSON.stringify(json)).not.toContain('PRIVATE KEY');
  });

  it('hands the DECRYPTED key to the edge projection, and only there', async () => {
    const record = await freshStore().upload({ host: 'site.test', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });
    expect(String(record.toEdgeJson().privateKeyPem)).toContain('BEGIN PRIVATE KEY');
  });

  it('refuses a mismatched key with a specific reason and writes NOTHING', async () => {
    freshStore();
    let reason: CertificateRejection | null = null;
    try {
      await store.upload({ host: 'site.test', certificatePem: read('good.crt'), privateKeyPem: read('other.key') });
    } catch (error) {
      reason = error instanceof CertificateValidationError ? error.reason : null;
    }

    expect(reason).toBe(CertificateRejection.KEY_MISMATCH);
    expect(rows).toHaveLength(0);
  });

  it('a refused replacement leaves the certificate that was already serving untouched', async () => {
    await freshStore().upload({ host: 'site.test', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });
    const before = rows[0].fingerprint_sha256;

    await expect(store.upload({ host: 'site.test', certificatePem: 'garbage', privateKeyPem: read('good.key') })).rejects.toThrow();

    expect(rows).toHaveLength(1);
    expect(rows[0].fingerprint_sha256).toBe(before);
  });

  it('clears the warning marker on a new upload, so the replacement warns from the start again', async () => {
    await freshStore().upload({ host: 'site.test', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });
    await store.markWarned('site.test', 7);
    expect(rows[0].last_warned_days).toBe(7);

    await store.upload({ host: 'site.test', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });
    expect(rows[0].last_warned_days).toBeNull();
  });

  it('treats a host with a trailing dot, a port or different case as ONE row', async () => {
    await freshStore().upload({ host: 'SITE.test.', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });
    await store.upload({ host: 'site.test:443', certificatePem: read('good.crt'), privateKeyPem: read('good.key') });
    expect(rows).toHaveLength(1);
    expect(rows[0].host).toBe('site.test');
  });

  it('leaves rows with no stored material out of the edge bundle', async () => {
    freshStore();
    rows.push({ host: 'empty.test', certificate_pem: '', private_key_enc: '', state: 'no_certificate' });
    expect(await store.edgeBundle()).toHaveLength(0);
  });

  it('reports an expired certificate as EXPIRED even though the column still says serving', () => {
    const record = CertificateRecord.from({
      host: 'old.test', source: 'uploaded', state: 'serving',
      certificate_pem: 'x', private_key_enc: 'enc:v1:x',
      not_after: new Date(Date.now() - 86_400_000).toISOString(),
    });

    expect(record.storedState).toBe(CertificateState.SERVING);
    expect(record.state).toBe(CertificateState.EXPIRED);
    expect(record.daysRemaining).toBeLessThan(0);
  });

  it('calls an uploaded certificate EXPIRING, not renewal-due — nothing here will renew it', () => {
    const soon = (source: string): CertificateRecord => CertificateRecord.from({
      host: 'soon.test', source, state: 'serving', certificate_pem: 'x', private_key_enc: 'enc:v1:x',
      not_after: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    });

    expect(soon(String(CertificateSource.UPLOADED.value)).state).toBe(CertificateState.EXPIRING);
    expect(soon(String(CertificateSource.AUTOMATIC.value)).state).toBe(CertificateState.RENEWAL_DUE);
  });

  it('does not overlay expiry onto a row that FAILED — a stale date must not look merely expiring', () => {
    const record = CertificateRecord.from({
      host: 'bad.test', source: 'uploaded', state: 'failed',
      not_after: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    });
    expect(record.state).toBe(CertificateState.FAILED);
  });
});
