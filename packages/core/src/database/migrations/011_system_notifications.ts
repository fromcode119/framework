import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';

/**
 * In-app notification inbox — one row per (user, message). Written ONLY by the framework's
 * notifications context (notifyAdmins fan-out + notifyUser); plugins never touch this table
 * directly. `read_at` NULL = unread. Idempotent CREATE TABLE IF NOT EXISTS per dialect.
 */
class SystemNotificationsMigration extends BaseMigration {
  readonly version = 11;
  readonly name = 'Create _system_notifications (in-app inbox)';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_notifications" (
            "id" SERIAL PRIMARY KEY,
            "user_id" INTEGER NOT NULL,
            "title" TEXT NOT NULL,
            "body" TEXT DEFAULT '',
            "link" TEXT DEFAULT '',
            "source" TEXT DEFAULT '',
            "read_at" TIMESTAMP NULL,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS "idx_system_notifications_user"
            ON "_system_notifications" ("user_id", "read_at")
        `);
      },
      mysql: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            link TEXT,
            source TEXT,
            read_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_system_notifications_user (user_id, read_at)
          )
        `));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_notifications" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "user_id" INTEGER NOT NULL,
            "title" TEXT NOT NULL,
            "body" TEXT DEFAULT '',
            "link" TEXT DEFAULT '',
            "source" TEXT DEFAULT '',
            "read_at" TEXT NULL,
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`
          CREATE INDEX IF NOT EXISTS "idx_system_notifications_user"
            ON "_system_notifications" ("user_id", "read_at")
        `));
      },
    });
  }
}

export default new SystemNotificationsMigration();
