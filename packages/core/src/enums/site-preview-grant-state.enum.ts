import { Enum } from '@fromcode119/react-class-components';

/**
 * Where a site-preview grant is in its one-way life: issued, then spent. There is no way back.
 *
 * THIS COLUMN IS THE SINGLE-USE LOCK, and it is a state rather than a timestamp for one concrete
 * reason. The claim is made by an UPDATE whose WHERE says "only if it has not been spent", so that
 * two browsers following the same link race on the database instead of in the gap between a read and
 * a write. On the raw system-table path a `null` in a WHERE compiles to `= NULL`, which is true of
 * nothing — so `consumed_at IS NULL` could not be expressed there, the claim matched zero rows, and
 * every exchange silently refused a perfectly good link. A NOT NULL value can be compared.
 *
 * `consumed_at` still records WHEN, which is what an operator would want to see; this records
 * WHETHER, which is what the lock needs.
 *
 * Compare against `.value` — the column holds a raw string, and an Enum tested against a string is
 * always false.
 */
export class SitePreviewGrantState extends Enum {
  /** Minted and not yet spent. The only state an exchange will accept. */
  static readonly ISSUED = new SitePreviewGrantState('issued');

  /** Exchanged for a session. Following the same link again gets nothing. */
  static readonly SPENT = new SitePreviewGrantState('spent');

  /**
   * The member a stored value names, or null when it names none.
   *
   * `find`, never a defaulting `resolve`: a row whose state cannot be read is a row nobody can say
   * is unspent, and "assume unspent" is the one wrong answer available.
   */
  static find(value: unknown): SitePreviewGrantState | null {
    if (value instanceof SitePreviewGrantState) return value;
    return (SitePreviewGrantState.fromValue(String(value ?? '').trim().toLowerCase()) as SitePreviewGrantState | undefined) ?? null;
  }
}
