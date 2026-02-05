import { SystemMigration } from '../../types';
import { executeForDialect } from '../helpers/dialect';

export const SecurityAuditLogsMigration: SystemMigration = {
  version: 2,
  name: 'Security audit logs schema',
  up: async (db, sql) => {
    await executeForDialect(db.dialect, {
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
      }
    });

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_audit_plugin" ON "_system_audit_logs"("plugin_slug");
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_audit_status" ON "_system_audit_logs"("status");
    `);
  },
  down: async (db, sql) => {
    await db.execute(sql`DROP TABLE IF EXISTS "_system_audit_logs";`);
  }
};
