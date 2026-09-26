import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * WHY an import decided what it did about one table's ids.
 *
 * A vocabulary rather than a sentence, and owned in ONE place because three layers read it: the
 * planner produces it, the plan carries it over the wire, and the admin turns it into the single line
 * an operator reads. It used to be a string union written out again in each of them, and a fourth
 * copy in a test fixture — which is how the list went stale, silently, when the per-tenant key
 * arrived and two of the four spellings still said otherwise.
 *
 * Compare against `.value` wherever it has crossed the wire: a plan is shown to the operator before
 * anything is written, so it travels as JSON and comes back as a raw string — the same reason
 * `TenantImportIdMode` says so.
 */
export class TenantImportIdBasis extends Enum {
  /** This platform has no such table, so there was nothing to compare against. */
  static readonly NO_TABLE = new TenantImportIdBasis('noTable');

  /** The table has no serial id; its rows are keyed by something else entirely. */
  static readonly NATURAL_KEY = new TenantImportIdBasis('naturalKey');

  /** No row in the archive carries a numeric id. */
  static readonly EMPTY = new TenantImportIdBasis('empty');

  /**
   * The table keys on `(tenant_id, id)`, so this site has its own id space and the archive's own
   * numbers cannot collide with another site's. Migration 049 is what makes this answer possible.
   */
  static readonly PER_TENANT_KEY = new TenantImportIdBasis('perTenantKey');

  /**
   * The key is still `id` alone — one pool of numbers shared by every site — but every arriving id
   * sits above what this platform has handed out, so they are safe to keep anyway.
   */
  static readonly ABOVE_SEQUENCE = new TenantImportIdBasis('aboveSequence');

  /** The key is still `id` alone and the ranges overlap, so the rows have to be renumbered. */
  static readonly BELOW_SEQUENCE = new TenantImportIdBasis('belowSequence');

  private constructor(value: string) {
    super(value);
  }

  /** The member a stored or wire value names, or null when it names none. */
  static find(value: unknown): TenantImportIdBasis | null {
    if (value instanceof TenantImportIdBasis) return value;
    return (TenantImportIdBasis.fromValue(String(value ?? '').trim()) as TenantImportIdBasis | undefined) ?? null;
  }
}
