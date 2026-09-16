import { describe, expect, it } from 'vitest';
import { CertificateRecord } from '@core/certificates/certificate-record';

/**
 * `CertificateRecord.from` hydrates a raw system-table row. `wildcard` is stored as a real boolean
 * on Postgres/MySQL but as 0/1 on SQLite, so it must read either the same way — via
 * `CoercionUtils.toBoolean`, the shared convention for this, not a hand-rolled `typeof` check.
 */
describe('CertificateRecord.from — wildcard boolean coercion', () => {
  const row = (wildcard: unknown) => ({
    host: 'example.test',
    source: 'automatic',
    state: 'serving',
    challenge: 'dns-01',
    wildcard,
  });

  it('reads a real boolean true/false as-is', () => {
    expect(CertificateRecord.from(row(true)).wildcard).toBe(true);
    expect(CertificateRecord.from(row(false)).wildcard).toBe(false);
  });

  it('reads SQLite-style 1/0 as true/false', () => {
    expect(CertificateRecord.from(row(1)).wildcard).toBe(true);
    expect(CertificateRecord.from(row(0)).wildcard).toBe(false);
  });

  it('reads the string forms "1"/"true" and "0"/"false"', () => {
    expect(CertificateRecord.from(row('1')).wildcard).toBe(true);
    expect(CertificateRecord.from(row('true')).wildcard).toBe(true);
    expect(CertificateRecord.from(row('0')).wildcard).toBe(false);
    expect(CertificateRecord.from(row('false')).wildcard).toBe(false);
  });

  it('reads null/undefined/garbage as false — never throws', () => {
    expect(CertificateRecord.from(row(null)).wildcard).toBe(false);
    expect(CertificateRecord.from(row(undefined)).wildcard).toBe(false);
    expect(CertificateRecord.from(row('not-a-boolean')).wildcard).toBe(false);
  });
});
