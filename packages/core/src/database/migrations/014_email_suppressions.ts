import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * The install's ONE list of addresses that must not be emailed.
 *
 * Any extension may send mail. Left to themselves each grows its own opt-out list, so a person who says
 * "stop emailing me" is honoured only by whichever sender they happened to click, and the operator has
 * as many lists to check as there are senders. This is the one list, enforced where mail actually
 * leaves, so a sender cannot forget to consult it.
 *
 * `category` is what makes it usable rather than blunt: a review-invitation opt-out must not silence
 * someone's order confirmation. A row with category `all` suppresses everything; any other value
 * suppresses just that stream. Mail sent with no category is transactional and only an `all` row stops
 * it — refusing a receipt because someone left a newsletter would be its own kind of bug.
 */
export class EmailSuppressionsMigration extends BaseMigration {
  readonly version = 14;
  readonly name = 'Create _system_email_suppressions (do-not-email list)';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
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
