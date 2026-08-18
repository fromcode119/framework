import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Puts `share_id` on the access log, and an index for reading it by time.
 *
 * The log only ever carried `grant_id`, so "what happened across every share this month" meant loading
 * the grants first and querying per grant. That is fine for one share's detail panel and wrong for an
 * activity screen, which asks the question the other way round. Denormalised rather than joined because
 * the log is append-only: a row's share cannot change after it is written, so there is nothing to keep
 * in sync.
 *
 * `created_at` gets an index for the same reason — every question on that screen is bounded by a date
 * range, and without one each range scans the whole table.
 *
 * Existing rows are backfilled from their grant. A row whose grant has since been deleted keeps a NULL
 * share, which is honest: the send it belonged to is gone, and inventing an id would be worse.
 */
export class FileAccessLogShareMigration extends BaseMigration {
  readonly version = 16;
  readonly name = 'Add share_id to _system_file_access_log';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_file_access_log" ADD COLUMN IF NOT EXISTS "share_id" INTEGER`);
        await db.execute(sql`
          UPDATE "_system_file_access_log" AS l
          SET "share_id" = g."share_id"
          FROM "_system_file_grants" AS g
          WHERE l."grant_id" = g."id" AND l."share_id" IS NULL
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_file_access_log_share" ON "_system_file_access_log" ("share_id")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_file_access_log_created" ON "_system_file_access_log" ("created_at")`);
      },
      mysql: async () => {
        await FileAccessLogShareMigration.addColumnIfMissing(db, 'ALTER TABLE _system_file_access_log ADD COLUMN share_id INT NULL');
        await db.execute(sql`
          UPDATE _system_file_access_log l
          JOIN _system_file_grants g ON g.id = l.grant_id
          SET l.share_id = g.share_id
          WHERE l.share_id IS NULL
        `);
        await FileAccessLogShareMigration.addColumnIfMissing(db, 'CREATE INDEX idx_file_access_log_share ON _system_file_access_log (share_id)');
        await FileAccessLogShareMigration.addColumnIfMissing(db, 'CREATE INDEX idx_file_access_log_created ON _system_file_access_log (created_at)');
      },
      sqlite: async () => {
        // SQLite has no ADD COLUMN IF NOT EXISTS; a re-run raises "duplicate column name", which is a
        // success for this migration's purposes.
        await FileAccessLogShareMigration.addColumnIfMissing(db, 'ALTER TABLE "_system_file_access_log" ADD COLUMN "share_id" INTEGER');
        await db.execute(sql.raw(`
          UPDATE "_system_file_access_log"
          SET "share_id" = (
            SELECT g."share_id" FROM "_system_file_grants" g WHERE g."id" = "_system_file_access_log"."grant_id"
          )
          WHERE "share_id" IS NULL
        `));
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "idx_file_access_log_share" ON "_system_file_access_log" ("share_id")`));
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "idx_file_access_log_created" ON "_system_file_access_log" ("created_at")`));
      },
    });
  }

  /** Runs a DDL statement, treating "already exists" as done rather than as a failure. */
  private static async addColumnIfMissing(db: IDatabaseManager, statement: string): Promise<void> {
    try {
      await db.execute(sql.raw(statement));
    } catch (error) {
      const message = String((error as { message?: unknown })?.message ?? error).toLowerCase();
      if (!message.includes('duplicate') && !message.includes('already exists')) throw error;
    }
  }
}
