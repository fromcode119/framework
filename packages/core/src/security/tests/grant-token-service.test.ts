import { describe, it, expect } from 'vitest';
import { GrantTokenService } from '@core/security/grant-token-service';
import { GrantOutcome } from '@core/security/enums/grant-outcome.enum';
import type { IGrantEvaluable } from '@core/security/interfaces/grant-evaluable.interface';

const NOW = new Date('2026-08-15T12:00:00.000Z');

const grant = (over: Partial<IGrantEvaluable> = {}): IGrantEvaluable => ({
  expiresAt: null, revokedAt: null, maxUses: 0, useCount: 0,
  ...over,
});

describe('GrantTokenService.mint', () => {
  it('never returns the same token twice', () => {
    const seen = new Set(Array.from({ length: 200 }, () => GrantTokenService.mint().raw));
    expect(seen.size).toBe(200);
  });

  it('stores a hash that does not reveal the token', () => {
    const { raw, hash } = GrantTokenService.mint();
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(raw);
    expect(GrantTokenService.hash(raw)).toBe(hash);
  });

  it('matches only the token it was minted from', () => {
    const { raw, hash } = GrantTokenService.mint();
    expect(GrantTokenService.matches(raw, hash)).toBe(true);
    expect(GrantTokenService.matches(GrantTokenService.mint().raw, hash)).toBe(false);
  });

  it('rejects rather than throws on a malformed stored hash', () => {
    expect(GrantTokenService.matches('anything', '')).toBe(false);
    expect(GrantTokenService.matches('anything', 'not-hex-and-wrong-length')).toBe(false);
  });
});

describe('GrantTokenService.evaluate', () => {
  it('grants an unrestricted, unexpired grant', () => {
    expect(GrantTokenService.evaluate(grant(), NOW)).toBe(GrantOutcome.GRANTED);
  });

  it('reads a missing grant as UNKNOWN rather than throwing', () => {
    expect(GrantTokenService.evaluate(null, NOW)).toBe(GrantOutcome.UNKNOWN);
    expect(GrantTokenService.evaluate(undefined, NOW)).toBe(GrantOutcome.UNKNOWN);
  });

  it('reports revocation ahead of expiry, so the log records the deliberate act', () => {
    const both = grant({ revokedAt: '2026-08-01T00:00:00.000Z', expiresAt: '2026-08-02T00:00:00.000Z' });
    expect(GrantTokenService.evaluate(both, NOW)).toBe(GrantOutcome.REVOKED);
  });

  it('treats absent expiry as never', () => {
    expect(GrantTokenService.evaluate(grant({ expiresAt: null }), NOW)).toBe(GrantOutcome.GRANTED);
    expect(GrantTokenService.evaluate(grant({ expiresAt: '' }), NOW)).toBe(GrantOutcome.GRANTED);
  });

  it('accepts either dialect shape for expiry', () => {
    // postgres hands back a Date for a TIMESTAMP column; SQLite hands back the stored TEXT.
    expect(GrantTokenService.evaluate(grant({ expiresAt: new Date('2026-08-16T00:00:00.000Z') }), NOW)).toBe(GrantOutcome.GRANTED);
    expect(GrantTokenService.evaluate(grant({ expiresAt: '2026-08-16T00:00:00.000Z' }), NOW)).toBe(GrantOutcome.GRANTED);
    expect(GrantTokenService.evaluate(grant({ expiresAt: new Date('2026-08-14T00:00:00.000Z') }), NOW)).toBe(GrantOutcome.EXPIRED);
  });

  it('expires exactly at the deadline, not a moment after', () => {
    expect(GrantTokenService.evaluate(grant({ expiresAt: NOW.toISOString() }), NOW)).toBe(GrantOutcome.EXPIRED);
  });

  it('treats an unparseable deadline as expired', () => {
    // An unreadable deadline is not a licence to serve the subject.
    expect(GrantTokenService.evaluate(grant({ expiresAt: 'whenever' }), NOW)).toBe(GrantOutcome.EXPIRED);
  });

  it('treats 0 and negative caps as unlimited', () => {
    expect(GrantTokenService.evaluate(grant({ maxUses: 0, useCount: 9999 }), NOW)).toBe(GrantOutcome.GRANTED);
    expect(GrantTokenService.evaluate(grant({ maxUses: -1, useCount: 9999 }), NOW)).toBe(GrantOutcome.GRANTED);
  });

  it('refuses once the cap is reached, and allows the final permitted use', () => {
    expect(GrantTokenService.evaluate(grant({ maxUses: 3, useCount: 2 }), NOW)).toBe(GrantOutcome.GRANTED);
    expect(GrantTokenService.evaluate(grant({ maxUses: 3, useCount: 3 }), NOW)).toBe(GrantOutcome.OVER_LIMIT);
    expect(GrantTokenService.evaluate(grant({ maxUses: 3, useCount: 4 }), NOW)).toBe(GrantOutcome.OVER_LIMIT);
  });
});

describe('GrantOutcome', () => {
  it('only GRANTED is granted', () => {
    const refusals = [
      GrantOutcome.UNKNOWN, GrantOutcome.EXPIRED, GrantOutcome.REVOKED,
      GrantOutcome.OVER_LIMIT, GrantOutcome.ACCOUNT_REQUIRED, GrantOutcome.CONFIRMATION_REQUIRED,
    ];
    expect(GrantOutcome.GRANTED.isGranted).toBe(true);
    expect(refusals.every((o) => !o.isGranted)).toBe(true);
  });

  it('marks only the recoverable refusals as actionable', () => {
    // The rest must reach the visitor as one indistinguishable "no longer available" — an expired token
    // reported as expired confirms it once existed.
    expect(GrantOutcome.ACCOUNT_REQUIRED.isActionable).toBe(true);
    expect(GrantOutcome.CONFIRMATION_REQUIRED.isActionable).toBe(true);
    expect(GrantOutcome.EXPIRED.isActionable).toBe(false);
    expect(GrantOutcome.REVOKED.isActionable).toBe(false);
    expect(GrantOutcome.UNKNOWN.isActionable).toBe(false);
    expect(GrantOutcome.OVER_LIMIT.isActionable).toBe(false);
  });

  it('fails closed on an unrecognised stored value', () => {
    expect(GrantOutcome.resolve('granted')).toBe(GrantOutcome.GRANTED);
    expect(GrantOutcome.resolve('something-else')).toBe(GrantOutcome.UNKNOWN);
    expect(GrantOutcome.resolve(null)).toBe(GrantOutcome.UNKNOWN);
  });
});
