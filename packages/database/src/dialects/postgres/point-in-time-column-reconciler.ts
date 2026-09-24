import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';

/**
 * Turns a TEXT column that a collection declares as a date or datetime into `timestamptz`.
 *
 * The schema builders had no case for `datetime`, so every such field got a TEXT column: values sorted
 * and compared as strings, and nothing stopped a non-date being written. A `timestamptz` holds an exact
 * instant, which the admin renders in the site's timezone.
 *
 * Converted only when every non-empty value is an ISO-8601 date or timestamp; blank becomes NULL, and
 * a value with no zone is read as UTC (the platform's database timezone). The pre-check is advisory —
 * under row-level security it may not see every row — so the guarantee is the ALTER itself: it is one
 * statement, and a single value that will not cast makes it fail with nothing changed. Either way the
 * outcome is REPORTED, never thrown.
 */
export class PostgresPointInTimeColumnReconciler {
  constructor(private readonly run: ISqlRunner) {}

  async ensure(table: string, column: string): Promise<SchemaReconcileOutcome> {
    const rows = await this.run(PostgresPointInTimeColumnReconciler.COLUMN_TYPE, [table, column]);
    const type = String(rows?.[0]?.data_type ?? '');
    if (type !== 'text') return SchemaReconcileOutcome.satisfied();

    const name = PostgresPointInTimeColumnReconciler.assertIdentifier(table);
    const col = PostgresPointInTimeColumnReconciler.assertIdentifier(column);
    const invalid = await this.run(
      `SELECT count(*)::int AS n FROM "${name}" WHERE NULLIF(btrim("${col}"), '') IS NOT NULL AND btrim("${col}") !~ $1`,
      [PostgresPointInTimeColumnReconciler.ISO_8601],
    );
    const count = Number(invalid?.[0]?.n ?? 0);
    if (count > 0) {
      return SchemaReconcileOutcome.failed(`${count} value(s) are not ISO-8601 dates; the column stays text until they are corrected`);
    }

    try {
      await this.run(
        `ALTER TABLE "${name}" ALTER COLUMN "${col}" TYPE TIMESTAMP WITH TIME ZONE USING NULLIF(btrim("${col}"), '')::timestamptz`,
      );
      return SchemaReconcileOutcome.changed();
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      return SchemaReconcileOutcome.failed(String(error?.message || error));
    }
  }

  /** `2026-03-22`, `2026-03-22T09:00`, `2026-03-22 09:00:00.123Z`, `…+03:00` — nothing else. */
  static readonly ISO_8601 = '^\\d{4}-\\d{2}-\\d{2}([T ]\\d{2}:\\d{2}(:\\d{2}(\\.\\d+)?)?)?(Z|[+-]\\d{2}(:?\\d{2})?)?$';

  private static readonly COLUMN_TYPE =
    'SELECT c.data_type FROM information_schema.columns c '
    + 'WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = $2';

  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  private static assertIdentifier(name: string): string {
    const trimmed = String(name ?? '').trim();
    if (!PostgresPointInTimeColumnReconciler.IDENTIFIER.test(trimmed)) {
      throw new Error(`PostgresPointInTimeColumnReconciler: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`);
    }
    return trimmed;
  }
}
