import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';

/**
 * Turns a TEXT column that a collection declares as a boolean (`boolean` or `checkbox`) into BOOLEAN.
 *
 * The schema builders had no case for `checkbox`, so every such field got a TEXT column holding
 * `'true'`/`'false'`. A plugin reading its own rows then got the STRING `'false'`, and a check such as
 * `row.enabled !== false` treated a stored "no" as a yes.
 *
 * Converted only when every non-empty value is a boolean Postgres reads (`true`/`false`, `t`/`f`,
 * `yes`/`no`, `on`/`off`, `1`/`0`, any case); blank becomes NULL. As with the date columns, the pre-check
 * is advisory and the ALTER is the guarantee — one statement, which changes nothing if a value will
 * not cast. The outcome is REPORTED, never thrown.
 */
export class PostgresBooleanColumnReconciler {
  constructor(private readonly run: ISqlRunner) {}

  async ensure(table: string, column: string): Promise<SchemaReconcileOutcome> {
    const rows = await this.run(PostgresBooleanColumnReconciler.COLUMN_TYPE, [table, column]);
    const type = String(rows?.[0]?.data_type ?? '');
    if (type !== 'text') return SchemaReconcileOutcome.satisfied();

    const name = PostgresBooleanColumnReconciler.assertIdentifier(table);
    const col = PostgresBooleanColumnReconciler.assertIdentifier(column);
    const invalid = await this.run(
      `SELECT count(*)::int AS n FROM "${name}" WHERE NULLIF(btrim("${col}"), '') IS NOT NULL AND lower(btrim("${col}")) <> ALL($1)`,
      [PostgresBooleanColumnReconciler.READABLE],
    );
    const count = Number(invalid?.[0]?.n ?? 0);
    if (count > 0) {
      return SchemaReconcileOutcome.failed(`${count} value(s) are not true or false; the column stays text until they are corrected`);
    }

    try {
      // The text default ('true'/'false') cannot be cast with the column, so it is dropped first and
      // put back as a boolean afterwards.
      const fallback = await this.run(PostgresBooleanColumnReconciler.COLUMN_DEFAULT, [table, column]);
      const textDefault = String(fallback?.[0]?.column_default ?? '');
      await this.run(`ALTER TABLE "${name}" ALTER COLUMN "${col}" DROP DEFAULT`);
      await this.run(`ALTER TABLE "${name}" ALTER COLUMN "${col}" TYPE BOOLEAN USING NULLIF(btrim("${col}"), '')::boolean`);
      const restored = PostgresBooleanColumnReconciler.booleanDefault(textDefault);
      if (restored) await this.run(`ALTER TABLE "${name}" ALTER COLUMN "${col}" SET DEFAULT ${restored}`);
      return SchemaReconcileOutcome.changed();
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      return SchemaReconcileOutcome.failed(String(error?.message || error));
    }
  }

  /** `'true'::text` → `true`; anything that is not a plain boolean default → nothing. */
  static booleanDefault(textDefault: string): string {
    const value = textDefault.replace(/::[a-z ]+$/i, '').replace(/^'(.*)'$/, '$1').trim().toLowerCase();
    if (['true', 't', 'yes', 'on', '1'].includes(value)) return 'true';
    if (['false', 'f', 'no', 'off', '0'].includes(value)) return 'false';
    return '';
  }

  static readonly READABLE = ['true', 'false', 't', 'f', 'yes', 'no', 'y', 'n', 'on', 'off', '1', '0'];

  private static readonly COLUMN_TYPE =
    'SELECT c.data_type FROM information_schema.columns c '
    + 'WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = $2';

  private static readonly COLUMN_DEFAULT =
    'SELECT c.column_default FROM information_schema.columns c '
    + 'WHERE c.table_schema = current_schema() AND c.table_name = $1 AND c.column_name = $2';

  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  private static assertIdentifier(name: string): string {
    const trimmed = String(name ?? '').trim();
    if (!PostgresBooleanColumnReconciler.IDENTIFIER.test(trimmed)) {
      throw new Error(`PostgresBooleanColumnReconciler: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`);
    }
    return trimmed;
  }
}
