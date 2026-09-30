import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';

/**
 * Removes a column's DEFAULT — the one schema change a plugin used raw SQL for that no helper offered.
 *
 * Plugin migrations run on the OWNER connection, where raw SQL can do anything the table owner can —
 * including switching row-level security off. So what plugins need is offered as named, validated
 * operations instead, each confined to the plugin's own tables by the migration proxy. Dropping a
 * default changes no existing row; it only stops inventing a value the caller left out.
 */
export class PostgresColumnDefaultDropper {
  constructor(private readonly run: ISqlRunner) {}

  /** Drops the default when the column has one. A failure is REPORTED, never thrown. */
  async drop(table: string, column: string): Promise<SchemaReconcileOutcome> {
    const rows = await this.run(PostgresColumnDefaultDropper.COLUMN, [table, column]);
    const row = rows?.[0];
    if (!row || row.column_default === null || row.column_default === undefined) return SchemaReconcileOutcome.satisfied();

    try {
      await this.run(PostgresColumnDefaultDropper.dropStatement(table, column));
      return SchemaReconcileOutcome.changed();
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      return SchemaReconcileOutcome.failed(String(error?.message || error));
    }
  }

  private static readonly COLUMN =
    'SELECT c.column_default FROM information_schema.columns c '
    + 'WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = $2';

  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  private static dropStatement(table: string, column: string): string {
    const name = PostgresColumnDefaultDropper.assertIdentifier(table);
    const col = PostgresColumnDefaultDropper.assertIdentifier(column);
    return `ALTER TABLE "${name}" ALTER COLUMN "${col}" DROP DEFAULT`;
  }

  private static assertIdentifier(name: string): string {
    const trimmed = String(name ?? '').trim();
    if (!PostgresColumnDefaultDropper.IDENTIFIER.test(trimmed)) {
      throw new Error(`PostgresColumnDefaultDropper: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`);
    }
    return trimmed;
  }
}
