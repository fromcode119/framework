import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';
import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';

type SqlRunner = (text: string, values?: unknown[]) => Promise<Array<Record<string, unknown>>>;

/**
 * Creates a UNIQUE that a field DECLARES but the table does not carry.
 *
 * `unique: true` was only ever emitted when the COLUMN was created — inline on CREATE TABLE, or on
 * ADD COLUMN. Declaring it on a column that already existed did nothing at all: the plan
 * fingerprinted it and no DDL followed. So a plugin author who added the constraint to an existing
 * field got silence, and the only way to enforce it was to issue the DDL by hand — which is exactly
 * what mlm did, on the request connection, which is not the table's owner, so it failed on every
 * boot and the uniqueness was never enforced.
 *
 * NOT tenancy, despite living beside it: this was parked with the RLS SQL only because the isolation
 * sweep rewrites what it adds to `(column, tenant_id)` in the same pass — so a reconciled unique ends
 * up identical to one that came from CREATE TABLE, tenancy included.
 */
export class PostgresDeclaredUniqueReconciler {
  constructor(private readonly run: SqlRunner) {}

  /**
   * Adds the constraint, or reports why it did not.
   *
   * A failure is REPORTED, never thrown: an existing table may hold duplicate values that make the
   * constraint impossible, and refusing to start the whole deployment over one plugin's declaration
   * is a worse answer than saying so. The caller logs it; the column stays unenforced until the
   * duplicates are resolved.
   */
  async ensure(table: string, column: string): Promise<SchemaReconcileOutcome> {
    const covered = await this.run(TenantIsolationSql.uniqueCoverageStatement(), [table, column]);
    if ((covered ?? []).length > 0) return SchemaReconcileOutcome.satisfied();

    try {
      await this.run(TenantIsolationSql.addUniqueConstraintStatement(table, column));
      return SchemaReconcileOutcome.changed();
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      return SchemaReconcileOutcome.failed(String(error?.message || error));
    }
  }
}
