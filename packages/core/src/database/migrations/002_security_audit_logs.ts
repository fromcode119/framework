import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

export class SecurityAuditLogsMigration extends BaseMigration {
  readonly version = 2;
  readonly name = 'Security audit logs schema';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_audit_logs" (
            "id" SERIAL PRIMARY KEY,
            "plugin_slug" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "resource" TEXT,
            "status" TEXT NOT NULL,
            "metadata" JSONB,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
      },
      sqlite: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_audit_logs" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "plugin_slug" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "resource" TEXT,
            "status" TEXT NOT NULL,
            "metadata" TEXT,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
      },
      mysql: async () => {
        // `plugin_slug` and `status` are indexed below, and MySQL cannot index an unbounded column.
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_audit_logs" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "plugin_slug" VARCHAR(191) NOT NULL,
            "action" VARCHAR(191) NOT NULL,
            "resource" TEXT,
            "status" VARCHAR(64) NOT NULL,
            "metadata" JSON,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }
    });

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_audit_plugin" ON "_system_audit_logs"("plugin_slug");
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_audit_status" ON "_system_audit_logs"("status");
    `);
  }

  async down(db: IDatabaseManager): Promise<void> {
    await db.execute(sql`DROP TABLE IF EXISTS "_system_audit_logs";`);
  }
}
