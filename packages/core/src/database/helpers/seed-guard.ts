import { sql } from 'drizzle-orm';
import type { IDatabaseManager } from '@fromcode119/database';

/**
 * Insert a row only if it is not already there.
 *
 * Every dialect can do this and all three spell it differently: PostgreSQL `ON CONFLICT DO NOTHING`,
 * SQLite `INSERT OR IGNORE`, MySQL `INSERT IGNORE`. Migrations that seed permissions and roles wrote
 * the first two out by hand in per-dialect branches, which is how the third came to be missing
 * everywhere at once.
 *
 * WHY A HELPER AND NOT A BRANCH PER MIGRATION: this is a seed, so it runs on every install, and the
 * failure mode of getting it wrong is not a crash — it is a duplicate-key error on the SECOND boot of
 * a deployment that already worked once. Writing it in one place means one thing to be right.
 *
 * Values are BOUND, never interpolated: a permission description is ordinary text and has no business
 * being parsed as SQL.
 */
export class SeedGuard {
  /**
   * `INSERT` the given columns, doing nothing when a row with the same key already exists.
   *
   * `conflictColumns` names the key that decides "already there". PostgreSQL is the only dialect that
   * needs to be told — the other two infer it from whichever unique constraint the row violates — but
   * it is required here rather than optional, because a caller that cannot name the key is a caller
   * that has not decided what makes the row unique.
   */
  static async insertIfMissing(
    db: IDatabaseManager,
    table: string,
    row: Record<string, unknown>,
    conflictColumns: string[],
  ): Promise<void> {
    const columns = Object.keys(row);
    if (!columns.length) return;
    if (!conflictColumns.length) {
      throw new Error(`SeedGuard: inserting into "${table}" without naming what makes the row unique.`);
    }

    const quoted = columns.map((column) => `"${column}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((column) => row[column]);
    const dialect = String(db.dialect || '').toLowerCase();

    const statement = dialect.includes('postgres')
      ? `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders}) `
        + `ON CONFLICT (${conflictColumns.map((column) => `"${column}"`).join(', ')}) DO NOTHING`
      : dialect.includes('mysql')
        ? `INSERT IGNORE INTO "${table}" (${quoted}) VALUES (${placeholders})`
        : `INSERT OR IGNORE INTO "${table}" (${quoted}) VALUES (${placeholders})`;

    await db.execute(SeedGuard.bind(statement, values));
  }

  /**
   * Build a parameterised statement from `?` placeholders.
   *
   * Written this way because the statement text differs per dialect while the values do not, so the
   * alternative is three nearly identical tagged templates — and a tagged template cannot be
   * assembled from a string chosen at runtime.
   */
  private static bind(statement: string, values: unknown[]) {
    const parts = statement.split('?');
    const chunks: unknown[] = [sql.raw(parts[0])];
    values.forEach((value, index) => {
      chunks.push(sql`${value}`);
      chunks.push(sql.raw(parts[index + 1] ?? ''));
    });
    return sql.join(chunks as any, sql.raw(''));
  }
}
