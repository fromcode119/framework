import { describe, expect, it } from 'vitest';
import { CertificateIssuanceBackoff } from '@core/certificates/acme/certificate-issuance-backoff';

/**
 * The retry schedule IS the rate-limit compliance.
 *
 * Five failed validations per hostname per hour is the ceiling; every delay here has to stay well
 * under one attempt per hour so a persistently broken host can never consume that budget and lock
 * the operator out of fixing it.
 */
describe('CertificateIssuanceBackoff', () => {
  const from = new Date('2026-01-01T00:00:00Z');
  const hoursAfter = (date: Date): number => (date.getTime() - from.getTime()) / 3_600_000;

  it('doubles from two hours', () => {
    expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(1, from))).toBe(2);
    expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(2, from))).toBe(4);
    expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(3, from))).toBe(8);
    expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(4, from))).toBe(16);
  });

  it('caps at a day, so a forgotten domain is still retried when somebody fixes it', () => {
    expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(5, from))).toBe(24);
    expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(50, from))).toBe(24);
  });

  it('never returns no delay, however the counter is called', () => {
    for (const failures of [0, -1, 0.4]) {
      expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(failures, from))).toBe(2);
    }
  });

  it('stays under one attempt per hour at every step — the authority ceiling is five', () => {
    for (let failures = 1; failures <= 10; failures += 1) {
      expect(hoursAfter(CertificateIssuanceBackoff.nextAttemptAfter(failures, from))).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the cheap failures short — they never reach the authority', () => {
    expect(CertificateIssuanceBackoff.DNS_RECHECK_MS).toBe(5 * 60 * 1000);
    expect(CertificateIssuanceBackoff.UNREACHABLE_RECHECK_MS).toBe(10 * 60 * 1000);
  });
});
