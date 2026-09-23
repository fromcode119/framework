import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * What the platform records about messages it delivers.
 *
 *  - `_system_notifications` — the in-app inbox, one row per (user, message). Written ONLY by the
 *    framework's notifications context (`notifyAdmins` fan-out and `notifyUser`); plugins never touch
 *    it. `read_at` NULL means unread.
 *  - `_system_webhook_deliveries` — one row per webhook dispatch attempt: event, HTTP status, response
 *    snippet, and the request body so a failed delivery can be resent. The history behind the admin's
 *    webhook deliveries screen.
 *  - `_system_email_suppressions` — the install's ONE do-not-email list, enforced where mail leaves so
 *    no sender can forget it. `category` keeps it precise: `all` suppresses everything, any other value
 *    just that stream, and mail sent with no category is transactional and only an `all` row stops it —
 *    a newsletter opt-out must never refuse someone's receipt.
 *
 * Versions 11–14 consolidated; a database that ran them has all four recorded and runs nothing here.
 */
export class SystemDeliveryRecordsMigration extends BaseMigration {
  readonly version = 11;
  readonly name = 'Notifications, webhook deliveries and email suppressions';

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
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_webhook_deliveries" (
            "id" SERIAL PRIMARY KEY,
            "webhook_id" INTEGER NOT NULL,
            "event" TEXT NOT NULL,
            "status" INTEGER DEFAULT 0,
            "ok" BOOLEAN DEFAULT FALSE,
            "response" TEXT DEFAULT '',
            "request_body" TEXT DEFAULT '',
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_hook" ON "_system_webhook_deliveries" ("webhook_id", "id")`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_email_suppressions" (
            "id" SERIAL PRIMARY KEY,
            "address" TEXT NOT NULL,
            "category" TEXT NOT NULL DEFAULT 'all',
            "source" TEXT DEFAULT '',
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_suppressions_addr_cat" ON "_system_email_suppressions" ("address", "category")`);
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
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_webhook_deliveries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            webhook_id INT NOT NULL,
            event TEXT NOT NULL,
            status INT DEFAULT 0,
            ok TINYINT(1) DEFAULT 0,
            response TEXT,
            request_body TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_webhook_deliveries_hook (webhook_id, id)
          )
        `));
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_email_suppressions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            address VARCHAR(320) NOT NULL,
            category VARCHAR(64) NOT NULL DEFAULT 'all',
            source TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY idx_email_suppressions_addr_cat (address, category)
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
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_webhook_deliveries" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "webhook_id" INTEGER NOT NULL,
            "event" TEXT NOT NULL,
            "status" INTEGER DEFAULT 0,
            "ok" INTEGER DEFAULT 0,
            "response" TEXT DEFAULT '',
            "request_body" TEXT DEFAULT '',
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_hook" ON "_system_webhook_deliveries" ("webhook_id", "id")`));
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_email_suppressions" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "address" TEXT NOT NULL,
            "category" TEXT NOT NULL DEFAULT 'all',
            "source" TEXT DEFAULT '',
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_email_suppressions_addr_cat" ON "_system_email_suppressions" ("address", "category")`));
      },
    });
  }
}
