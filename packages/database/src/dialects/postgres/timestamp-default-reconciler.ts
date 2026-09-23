import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';

/**
 * Gives a row-timestamp column (`created_at` / `updated_at`) its `DEFAULT CURRENT_TIMESTAMP` back.
 *
 * The schema builder emits those columns WITH that default only when no field claims them. A
 * collection that declares its own `createdAt` — the orders collection does, so an admin can correct
 * a backdated import — got a plain column with no default, and every row inserted without an explicit
 * value was stored with no creation date at all. Nothing downstream can recover that time.
 *
 * Adding a default is safe on any table: it changes no existing row and only fills a value the caller
 * left out. It never replaces a default that is already there.
 */
export class PostgresTimestampDefaultReconciler {
  constructor(private readonly run: ISqlRunner) {}

  /** Adds the default when the column exists without one. A failure is REPORTED, never thrown. */
  async ensure(table: string, column: string): Promise<SchemaReconcileOutcome> {
    const rows = await this.run(PostgresTimestampDefaultReconciler.COLUMN, [table, column]);
    const row = rows?.[0];
    if (!row) return SchemaReconcileOutcome.satisfied();
    if (row.column_default !== null && row.column_default !== undefined) return SchemaReconcileOutcome.satisfied();

    try {
      await this.run(PostgresTimestampDefaultReconciler.setDefaultStatement(table, column));
      return SchemaReconcileOutcome.changed();
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      return SchemaReconcileOutcome.failed(String(error?.message || error));
    }
  }

  private static readonly COLUMN =
    'SELECT c.column_default FROM information_schema.columns c '
    + 'WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = $2';

  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  private static setDefaultStatement(table: string, column: string): string {
    const name = PostgresTimestampDefaultReconciler.assertIdentifier(table);
    const col = PostgresTimestampDefaultReconciler.assertIdentifier(column);
    return `ALTER TABLE "${name}" ALTER COLUMN "${col}" SET DEFAULT CURRENT_TIMESTAMP`;
  }

  private static assertIdentifier(name: string): string {
    const trimmed = String(name ?? '').trim();
    if (!PostgresTimestampDefaultReconciler.IDENTIFIER.test(trimmed)) {
      throw new Error(`PostgresTimestampDefaultReconciler: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`);
    }
    return trimmed;
  }
}
