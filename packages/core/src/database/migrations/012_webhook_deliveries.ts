import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Per-delivery webhook log — one row per dispatch attempt (event, HTTP status, response snippet,
 * and the request body so a failed delivery can be resent). The webhook row still keeps `lastStatus`
 * for a quick glance; this table is the full history behind the admin webhooks/deliveries UI.
 */
export class WebhookDeliveriesMigration extends BaseMigration {
  readonly version = 12;
  readonly name = 'Create _system_webhook_deliveries (webhook delivery log)';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
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
      },
      mysql: async () => {
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
      },
      sqlite: async () => {
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
      },
    });
  }
}
