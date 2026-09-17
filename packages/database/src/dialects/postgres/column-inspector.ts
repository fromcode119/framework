import type { IColumnStats } from '@database/interfaces/column-stats.interface';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';


/**
 * Reads how much is actually IN a column, and drops one when a human has said to.
 *
 * This exists for the approval queue: an operator deciding whether an undeclared column is safe to
 * drop is really asking "is that data already in the new column, or am I about to lose it?", and a
 * row count with a sample value is what answers it. `invoice_date` turned out to duplicate
 * `created_at` and was safe; `products.weight_kg` had moved into `dimensions.weight` and was not.
 * Neither a silent drop nor a silent keep gets both right.
 *
 * THE COUNT IS ONLY AS TRUE AS THE CONNECTION IT RUNS ON. Tenant-scoped tables carry FORCE row-level
 * security, which applies to the table OWNER too — so counting from the boot connection with no
 * tenant bound returns 0 for every column of every isolated table, and a caller that trusted it
 * would propose dropping columns that are full. The caller is responsible for running this once per
 * tenant and summing; see `SchemaReconciliationService`.
 */
export class PostgresColumnInspector {
  constructor(private readonly run: ISqlRunner) {}

  /**
   * Row count, non-null count, NON-EMPTY count and one sample value.
   *
   * THREE THINGS HERE ARE DELIBERATE, AND ALL THREE WERE WRONG IN THE FIRST VERSION.
   *
   * 1. `::text` on everything. The original picked the sample with `max("col")`, which does not
   *    exist for `jsonb` or `boolean` — and the Postgres builder maps `json`, `relationship`,
   *    `upload` and `richText` to JSONB and `boolean`/`checkbox` to BOOLEAN, so the statement threw
   *    for MOST of the column types that actually go orphaned. The entry then reached the operator
   *    with no counts and no sample at all, sitting beside genuinely empty columns.
   * 2. `non_empty` as well as `non_null`. `count(col)` counts NON-NULL, and an empty string is not
   *    null: a column holding `''` on every row reported "15 of 15 rows held a value" and sorted to
   *    the top as the most dangerous drop in the queue, when it was the safest. The two numbers
   *    together are what tell an operator the difference.
   * 3. A sample taken from the FIRST non-empty row, not `max()`. The maximum of a date column is
   *    always the newest value, which reads as "still in use" whatever the distribution.
   */
  async stats(table: string, column: string): Promise<IColumnStats> {
    const name = PostgresColumnInspector.assertIdentifier(table);
    const col = PostgresColumnInspector.assertIdentifier(column);

    const rows = await this.run(
      `SELECT count(*)::int AS rows, `
      + `count("${col}")::int AS non_null, `
      + `count(nullif(btrim("${col}"::text), ''))::int AS non_empty, `
      + `(SELECT left(t."${col}"::text, 120) FROM "${name}" t `
      + `  WHERE t."${col}" IS NOT NULL AND btrim(t."${col}"::text) <> '' LIMIT 1) AS sample `
      + `FROM "${name}"`,
    );
    const row = rows?.[0] ?? {};
    return {
      rows: Number(row.rows ?? 0),
      nonNull: Number(row.non_null ?? 0),
      nonEmpty: Number(row.non_empty ?? 0),
      sample: row.sample === null || row.sample === undefined ? '' : String(row.sample),
    };
  }

  /**
   * Drops the column. IRREVERSIBLE, and deliberately has no "if empty" convenience built in — the
   * decision belongs to the caller that showed a human the numbers, not to this method.
   */
  async drop(table: string, column: string): Promise<void> {
    const name = PostgresColumnInspector.assertIdentifier(table);
    const col = PostgresColumnInspector.assertIdentifier(column);
    await this.run(`ALTER TABLE "${name}" DROP COLUMN IF EXISTS "${col}"`);
  }

  /** Every table in the current schema — for finding ones no collection declares. */
  async tables(): Promise<string[]> {
    const rows = await this.run(
      "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename",
    );
    return (rows ?? []).map((row) => String(row.tablename)).filter(Boolean);
  }

  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  private static assertIdentifier(name: string): string {
    const trimmed = String(name ?? '').trim();
    if (!PostgresColumnInspector.IDENTIFIER.test(trimmed)) {
      throw new Error(`PostgresColumnInspector: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`);
    }
    return trimmed;
  }
}
