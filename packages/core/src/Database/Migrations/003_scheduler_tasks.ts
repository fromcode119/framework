import { SystemMigration } from '../../types';
import { executeForDialect } from '../helpers/dialect';

export const SchedulerTasksMigration: SystemMigration = {
  version: 3,
  name: 'Scheduler tasks schema',
  up: async (db, sql) => {
    await executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_scheduler_tasks" (
            "id" SERIAL PRIMARY KEY,
            "name" TEXT NOT NULL UNIQUE,
            "plugin_slug" TEXT REFERENCES "_system_plugins"("slug") ON DELETE CASCADE,
            "schedule" TEXT NOT NULL, -- Cron expression or interval
            "type" TEXT NOT NULL DEFAULT 'cron', -- 'cron' or 'interval'
            "last_run" TIMESTAMP WITH TIME ZONE,
            "next_run" TIMESTAMP WITH TIME ZONE,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
      },
      sqlite: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_scheduler_tasks" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "name" TEXT NOT NULL UNIQUE,
            "plugin_slug" TEXT REFERENCES "_system_plugins"("slug") ON DELETE CASCADE,
            "schedule" TEXT NOT NULL,
            "type" TEXT NOT NULL DEFAULT 'cron',
            "last_run" DATETIME,
            "next_run" DATETIME,
            "is_active" INTEGER NOT NULL DEFAULT 1,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    });
  },
  down: async (db, sql) => {
    await db.execute(sql`DROP TABLE IF EXISTS "_system_scheduler_tasks"`);
  }
};
