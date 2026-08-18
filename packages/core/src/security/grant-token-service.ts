import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { GrantOutcome } from '@core/security/enums/grant-outcome.enum';
import type { IGrantEvaluable } from '@core/security/interfaces/grant-evaluable.interface';

/**
 * The framework's ONE implementation of a revocable, expiring, countable access token.
 *
 * DB-backed and opaque rather than a signed HMAC. The framework already has the stateless-HMAC pattern
 * (`EmailPreferencesTokenService`), and it is the wrong tool here: a signed token cannot be revoked
 * short of rotating the install key — which would invalidate every other link at once — and cannot
 * count uses. Expiry, revocation and a usage cap are the whole feature, so the token has to be a row.
 *
 * Only `sha256(raw)` is ever persisted. The raw value is handed back once, at creation.
 *
 * It knows nothing about what the token opens. File shares hold media ids and a plugin's share links
 * hold that plugin's record id; both mint here and both evaluate here, so there is one place where "is this link
 * still good" is decided. Two implementations of that answer is exactly the duplication CLAUDE.md calls
 * framework work.
 *
 * `evaluate` is deliberately pure: it takes a loaded row and the current time and returns an outcome,
 * touching no database. That keeps every refusal path testable without fixtures, and it keeps expiry
 * comparison in JS — on SQLite an ISO string written by the application and a `datetime('now')` default
 * sort differently, so a SQL predicate on `expires_at` matches the wrong rows.
 */
export class GrantTokenService {
  /** 32 bytes: the same width as the framework's password-reset tokens. */
  private static readonly TOKEN_BYTES = 32;

  /** A fresh token. `raw` goes in the email and is never recoverable; `hash` is what gets stored. */
  static mint(): { raw: string; hash: string } {
    const raw = randomBytes(GrantTokenService.TOKEN_BYTES).toString('hex');
    return { raw, hash: GrantTokenService.hash(raw) };
  }

  static hash(rawToken: string): string {
    return createHash('sha256').update(String(rawToken ?? '')).digest('hex');
  }

  /**
   * Constant-time comparison of two hashes. Lookup is by indexed hash, so this guards the narrower case
   * of comparing a candidate against a hash already in hand.
   */
  static matches(candidateRaw: string, storedHash: string): boolean {
    const candidate = Buffer.from(GrantTokenService.hash(candidateRaw), 'hex');
    const stored = Buffer.from(String(storedHash ?? ''), 'hex');
    if (candidate.length !== stored.length || stored.length === 0) return false;
    return timingSafeEqual(candidate, stored);
  }

  /**
   * What this grant permits right now.
   *
   * Order matters: revoked is reported before expired, and both before the usage cap, so the log records
   * the operator's deliberate act rather than whichever condition happens to also be true. `null`/absent
   * grant reads as UNKNOWN — the caller never has to distinguish "no row" from "bad row".
   */
  static evaluate(grant: IGrantEvaluable | null | undefined, now: Date = new Date()): GrantOutcome {
    if (!grant) return GrantOutcome.UNKNOWN;
    if (grant.revokedAt) return GrantOutcome.REVOKED;

    if (GrantTokenService.hasExpired(grant.expiresAt, now)) return GrantOutcome.EXPIRED;

    // 0 means unlimited, everywhere in this model. The features this generalises disagreed —
    // one used 0 for "never expires" while another read both -1 and 0 as "unlimited" — so a
    // negative cap is treated as unlimited too rather than left to mean something new.
    const cap = Number(grant.maxUses ?? 0);
    const used = Number(grant.useCount ?? 0);
    if (cap > 0 && used >= cap) return GrantOutcome.OVER_LIMIT;

    return GrantOutcome.GRANTED;
  }

  /** Absent expiry means never. An unparseable value is treated as expired — an unreadable deadline is not a licence. */
  private static hasExpired(expiresAt: IGrantEvaluable['expiresAt'], now: Date): boolean {
    if (expiresAt === null || expiresAt === undefined || expiresAt === '') return false;

    const deadline = expiresAt instanceof Date ? expiresAt : new Date(String(expiresAt));
    if (Number.isNaN(deadline.getTime())) return true;

    return deadline.getTime() <= now.getTime();
  }
}
