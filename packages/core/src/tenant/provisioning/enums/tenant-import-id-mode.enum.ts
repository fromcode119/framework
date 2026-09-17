import { Enum } from '@fromcode119/react-class-components';

/**
 * What an import does with a table's EXISTING ids.
 *
 * The three are not interchangeable and the choice is made from evidence, never a default:
 * `PRESERVE` when the archive's ids cannot collide with what this platform has already handed out,
 * `REMAP` when they can, and `SKIP` when the table does not exist here at all.
 *
 * Compare against `.value` wherever the mode has crossed the wire — a plan is shown to the operator
 * before anything is written, so it travels as JSON and comes back as a raw string.
 */
export class TenantImportIdMode extends Enum {
  /** The archive's ids are written as they are. */
  static readonly PRESERVE = new TenantImportIdMode('preserve');

  /** Every id is re-numbered, and every reference to it repointed. */
  static readonly REMAP = new TenantImportIdMode('remap');

  /** The table is not imported — this platform has no such table. */
  static readonly SKIP = new TenantImportIdMode('skip');

  private constructor(value: string) {
    super(value);
  }

  /** The member a stored or wire value names, or null when it names none. */
  static find(value: unknown): TenantImportIdMode | null {
    if (value instanceof TenantImportIdMode) return value;
    return (TenantImportIdMode.fromValue(String(value ?? '').trim().toLowerCase()) as TenantImportIdMode | undefined) ?? null;
  }
}
