import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CertificateMaterial } from '@core/certificates/certificate-material';
import { CertificateRejection } from '@core/enums/certificate-rejection.enum';
import { CertificateValidationError } from '@core/certificates/certificate-validation-error';

/**
 * The gate every uploaded certificate passes through.
 *
 * Certificates are GENERATED HERE, not checked in as fixtures: a committed PEM expires, and the day
 * it does this suite starts failing for a reason that has nothing to do with the code. Generating
 * them means the "valid" case is genuinely valid every time it runs.
 *
 * Each refusal is silent in production — a mismatched key fails only at the TLS handshake, a wrong
 * name only in the visitor's browser — so these tests are the only place they are visible early.
 */
describe('CertificateMaterial — what may be stored as a certificate', () => {
  let dir = '';
  const read = (name: string): string => readFileSync(join(dir, name), 'utf8');

  const openssl = (args: string[]): void => {
    execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
  };

  beforeAll(() => {
    // A missing openssl must FAIL, never skip: a skipped test here is a hole nobody sees again.
    execFileSync('openssl', ['version'], { stdio: 'pipe' });
    dir = mkdtempSync(join(tmpdir(), 'fc-cert-'));

    openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'good.key', '-out', 'good.crt',
      '-days', '30', '-subj', '/CN=site.test', '-addext', 'subjectAltName=DNS:site.test,DNS:*.wild.test']);
    openssl(['genrsa', '-out', 'other.key', '2048']);
    openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'expired.key', '-out', 'expired.crt',
      '-not_before', '20200101000000Z', '-not_after', '20200102000000Z',
      '-subj', '/CN=site.test', '-addext', 'subjectAltName=DNS:site.test']);
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const rejection = (fn: () => unknown): CertificateRejection | null => {
    try {
      fn();
    } catch (error) {
      return error instanceof CertificateValidationError ? error.reason : null;
    }
    return null;
  };

  it('accepts a certificate and its own key for a host it covers, and reads what the file says', () => {
    const material = CertificateMaterial.parse(read('good.crt'), read('good.key'), 'site.test');

    expect(material.subjectAltNames).toContain('site.test');
    expect(material.notAfter.getTime()).toBeGreaterThan(Date.now());
    expect(material.issuer).toContain('site.test');
    expect(material.fingerprintSha256).toMatch(/^[0-9A-F]{2}(:[0-9A-F]{2})+$/);
    expect(material.serial.length).toBeGreaterThan(0);
  });

  it('stores the key in one canonical form rather than however it was pasted', () => {
    const material = CertificateMaterial.parse(read('good.crt'), read('good.key'), 'site.test');
    expect(material.privateKeyPem).toContain('BEGIN PRIVATE KEY');
  });

  it('matches a wildcard SAN against a subdomain', () => {
    expect(() => CertificateMaterial.parse(read('good.crt'), read('good.key'), 'shop.wild.test')).not.toThrow();
  });

  it('does NOT match a wildcard against the apex — browsers do not, so neither may we', () => {
    expect(rejection(() => CertificateMaterial.parse(read('good.crt'), read('good.key'), 'wild.test')))
      .toBe(CertificateRejection.HOST_NOT_COVERED);
  });

  it('refuses a key from a different order', () => {
    expect(rejection(() => CertificateMaterial.parse(read('good.crt'), read('other.key'), 'site.test')))
      .toBe(CertificateRejection.KEY_MISMATCH);
  });

  it('refuses a certificate issued for other names', () => {
    expect(rejection(() => CertificateMaterial.parse(read('good.crt'), read('good.key'), 'not-ours.test')))
      .toBe(CertificateRejection.HOST_NOT_COVERED);
  });

  it('refuses an already-expired certificate rather than putting a broken one live', () => {
    expect(rejection(() => CertificateMaterial.parse(read('expired.crt'), read('expired.key'), 'site.test')))
      .toBe(CertificateRejection.ALREADY_EXPIRED);
  });

  it('refuses text that is not a certificate', () => {
    for (const bad of ['', '   ', 'hello', '-----BEGIN CERTIFICATE-----nope']) {
      expect(rejection(() => CertificateMaterial.parse(bad, read('good.key'), 'site.test')), bad)
        .toBe(CertificateRejection.CERTIFICATE_UNREADABLE);
    }
  });

  it('refuses text that is not a private key', () => {
    for (const bad of ['', 'hello', '-----BEGIN PRIVATE KEY-----nope']) {
      expect(rejection(() => CertificateMaterial.parse(read('good.crt'), bad, 'site.test')), bad)
        .toBe(CertificateRejection.PRIVATE_KEY_UNREADABLE);
    }
  });

  it('reports the EARLIEST problem, so the operator is not sent chasing a cascade', () => {
    // Unreadable certificate AND a mismatched key: the certificate is what to fix first.
    expect(rejection(() => CertificateMaterial.parse('garbage', read('other.key'), 'site.test')))
      .toBe(CertificateRejection.CERTIFICATE_UNREADABLE);
  });

  it('describeStored reads an EXPIRED certificate back — the admin must still be able to show it', () => {
    expect(CertificateMaterial.describeStored(read('expired.crt'))).not.toBeNull();
    expect(CertificateMaterial.describeStored('nonsense')).toBeNull();
  });
});
