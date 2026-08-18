/**
 * The only thing {@link GrantTokenService.evaluate} needs to know about a grant row.
 *
 * Deliberately narrower than any one feature's record: one owner's grant counts downloads and another's
 * counts views, and neither name belongs in the shared evaluator. Callers adapt their own row
 * at the call site, which is one line and keeps the rule in one place.
 *
 * Dates are `Date | string | null` because the dialects disagree: postgres returns a `Date` for a
 * TIMESTAMP column while SQLite returns the stored TEXT. Consumers must not assume either — that is why
 * the evaluator normalises before comparing rather than trusting the shape.
 */
export interface IGrantEvaluable {
  /** Null means never expires. */
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
  /** 0 (or any non-positive value) means unlimited. */
  maxUses: number;
  useCount: number;
}
