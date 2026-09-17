import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';


/**
 * Relaxes a NOT NULL that the schema no longer declares.
 *
 * `required: false` was only ever honoured when the COLUMN was created. Changing a field from
 * required to optional on a table that already exists did nothing at all: the plan fingerprinted the
 * new shape and no DDL followed, so the database went on rejecting the writes the declaration now
 * permits — "null value in column … violates not-null constraint" for a field the admin shows as
 * optional. It is the same gap the declared-UNIQUE reconcile closed from the other direction, and it
 * is the one the owner named: old column state surviving a plugin update is exactly what must not
 * happen.
 *
 * ONE DIRECTION ONLY, deliberately. This never ADDS a NOT NULL. Tightening a column is a decision
 * with data behind it — existing NULL rows have to go somewhere, and picking a value for them is
 * precisely the invented default this codebase forbids. Relaxing is safe: every row that satisfied
 * the stricter rule still satisfies the looser one, and nothing is lost. A field that becomes
 * required again is a migration someone writes, with the backfill stated.
 *
 * The primary key is never touched: its NOT NULL is structural, not a field declaration.
 */
export class PostgresDeclaredNullabilityReconciler {
  constructor(private readonly run: ISqlRunner) {}

  /**
   * Whether `column` on `table` is NOT NULL while the schema says it is optional, and if so, relax it.
   *
   * A failure is REPORTED, never thrown — consistent with the unique reconcile, and for the same
   * reason: one plugin's declaration must not be able to refuse the boot.
   */
  async relax(table: string, column: string): Promise<SchemaReconcileOutcome> {
    const rows = await this.run(PostgresDeclaredNullabilityReconciler.NULLABILITY, [table, column]);
    const row = rows?.[0];

    // No such column — nothing to relax, and not this reconcile's business to say so. A column the
    // plan expects and the table lacks is the `missingColumns` path's job.
    if (!row) return SchemaReconcileOutcome.satisfied();
    if (String(row.is_nullable).toUpperCase() === 'YES') return SchemaReconcileOutcome.satisfied();
    // Structural, not declared. Dropping it would break the table's identity.
    if (row.is_primary_key === true) return SchemaReconcileOutcome.satisfied();

    try {
      await this.run(PostgresDeclaredNullabilityReconciler.relaxStatement(table, column));
      return SchemaReconcileOutcome.changed();
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      return SchemaReconcileOutcome.failed(String(error?.message || error));
    }
  }

  /**
   * Is the column NOT NULL, and is it part of the primary key?
   *
   * Both in one round trip because the answer is only actionable together: a NOT NULL that comes
   * from the primary key must be left alone.
   */
  private static readonly NULLABILITY =
    'SELECT c.is_nullable, '
    + 'EXISTS (SELECT 1 FROM pg_index x JOIN pg_attribute a '
    + '  ON a.attrelid = x.indrelid AND a.attnum = ANY(x.indkey::int2[]) '
    + '  WHERE x.indrelid = quote_ident($1)::regclass AND x.indisprimary AND a.attname = $2) AS is_primary_key '
    + 'FROM information_schema.columns c '
    + 'WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = $2';

  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  private static relaxStatement(table: string, column: string): string {
    const name = PostgresDeclaredNullabilityReconciler.assertIdentifier(table);
    const col = PostgresDeclaredNullabilityReconciler.assertIdentifier(column);
    return `ALTER TABLE "${name}" ALTER COLUMN "${col}" DROP NOT NULL`;
  }

  private static assertIdentifier(name: string): string {
    const trimmed = String(name ?? '').trim();
    if (!PostgresDeclaredNullabilityReconciler.IDENTIFIER.test(trimmed)) {
      throw new Error(
        `PostgresDeclaredNullabilityReconciler: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`,
      );
    }
    return trimmed;
  }
}
