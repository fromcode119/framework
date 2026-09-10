import { Enum } from '@fromcode119/react-class-components';

/**
 * Why a grant did or did not open.
 *
 * These distinctions exist for the ACCESS LOG and for the operator, never for the visitor. Every
 * non-`GRANTED` outcome must reach the browser as the same opaque "this link is no longer available":
 * telling an anonymous caller that a token is *expired* rather than *unknown* confirms it once existed,
 * and naming what it held is a disclosure in itself.
 *
 * Nothing here is file-specific. A grant opens a SUBJECT — a set of files, a reading, whatever the
 * feature that minted it decided — so the outcome vocabulary is the same wherever the framework's one
 * token implementation is used.
 *
 * A reactor `Enum`, not a plain TS `enum`: members are singletons, so `outcome === GrantOutcome.GRANTED`
 * is an identity check. Comparing a member to a RAW string is always false — cross a string boundary (the
 * `outcome` column) via `.value`.
 */
export class GrantOutcome extends Enum {
  static readonly GRANTED = new GrantOutcome('granted');
  /** No grant carries this token hash. Also the answer for a malformed token. */
  static readonly UNKNOWN = new GrantOutcome('unknown');
  static readonly EXPIRED = new GrantOutcome('expired');
  static readonly REVOKED = new GrantOutcome('revoked');
  static readonly OVER_LIMIT = new GrantOutcome('over_limit');
  /** The grant requires a signed-in account matching its email, and the caller is not that person. */
  static readonly ACCOUNT_REQUIRED = new GrantOutcome('account_required');
  /** The grant requires the emailed confirmation code, and this browser has not passed it yet. */
  static readonly CONFIRMATION_REQUIRED = new GrantOutcome('confirmation_required');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; anything unrecognised fails closed as UNKNOWN. */
  static resolve(value: unknown): GrantOutcome {
    if (value instanceof GrantOutcome) return value;
    const found = GrantOutcome.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as GrantOutcome | undefined) ?? GrantOutcome.UNKNOWN;
  }

  get isGranted(): boolean {
    return this === GrantOutcome.GRANTED;
  }

  /**
   * True when the caller could still succeed by doing something (signing in, entering the code). The
   * landing page may prompt for those; every other refusal is final and says nothing.
   */
  get isActionable(): boolean {
    return this === GrantOutcome.ACCOUNT_REQUIRED || this === GrantOutcome.CONFIRMATION_REQUIRED;
  }
}
