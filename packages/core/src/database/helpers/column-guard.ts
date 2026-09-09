import { sql } from 'drizzle-orm';
import type { IDatabaseManager } from '@fromcode119/database';

/**
 * Adds a column only when the table does not already have it.
 *
 * `ALTER TABLE … ADD COLUMN IF NOT EXISTS` is **Postgres-only**. SQLite rejects the clause outright
 * (`near "EXISTS": syntax error`), so a migration that writes it into a `sqlite:` branch kills the API
 * at boot on every fresh SQLite database. That is what the tenancy migrations 021, 022 and 024 did:
 * each copied the Postgres statement verbatim into its SQLite branch, and since migrations run inside
 * `PluginManager.init`, the process never reached the point of serving a request.
 *
 * PROBING beats CATCHING. `getColumns` is on `IDatabaseManager` and both dialects implement it, so the
 * check costs one query and a genuine failure stays a failure — migration 028 instead catches the error
 * and string-matches `duplicate column name`, which also swallows anything else that goes wrong.
 */
export class ColumnGuard {
  /** `definition` is the type and constraints only, e.g. `TEXT` or `BOOLEAN NOT NULL DEFAULT FALSE`. */
  static async addIfMissing(db: IDatabaseManager, table: string, column: string, definition: string): Promise<void> {
    const existing = await db.getColumns(table);
    if (existing.map((name) => name.toLowerCase()).includes(column.toLowerCase())) return;
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`));
  }
}
