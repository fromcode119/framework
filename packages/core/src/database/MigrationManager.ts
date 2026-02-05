import { IDatabaseManager, sql } from '@fromcode/database';
import { Logger } from '../logging/logger';
import { SystemMigration } from '../types';
import { loadMigrations } from './migrations/index';

export class MigrationManager {
  private logger = new Logger({ namespace: 'MigrationManager' });

  constructor(private db: IDatabaseManager) {}

  async init() {
    const dialect = this.db.dialect;
    let query;
    if (dialect === 'postgres') {
      query = sql`
        CREATE TABLE IF NOT EXISTS _system_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version INTEGER NOT NULL,
          batch INTEGER NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } else if (dialect === 'mysql') {
      query = sql`
        CREATE TABLE IF NOT EXISTS _system_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version INT NOT NULL,
          batch INT NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } else {
      query = sql`
        CREATE TABLE IF NOT EXISTS _system_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          version INTEGER NOT NULL,
          batch INTEGER NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    }
    await this.db.execute(query);
  }

  async migrate(pluginMigrations: SystemMigration[] = []) {
    await this.init();
    const systemMigrations = loadMigrations();
    const allMigrations = [...systemMigrations, ...pluginMigrations];
    
    const executed = await this.db.find('_system_migrations', { columns: { version: true } });
    const executedVersions = new Set(executed.map((m: any) => m.version));

    const pending = allMigrations
      .filter(m => !executedVersions.has(m.version))
      .sort((a, b) => a.version - b.version);

    if (pending.length === 0) {
      this.logger.info('No pending migrations.');
      return;
    }

    const batch = (await this.getMaxBatch()) + 1;

    for (const migration of pending) {
      this.logger.info(`Running migration: ${migration.name} (v${migration.version})...`);
      await migration.up(this.db, sql);
      await this.db.insert('_system_migrations', {
        name: migration.name,
        version: migration.version,
        batch
      });
    }

    this.logger.info('Migrations completed successfully.');
  }

  async rollback() {
    await this.init();
    const batch = await this.getMaxBatch();
    if (batch === 0) {
      this.logger.info('No migrations to rollback.');
      return;
    }

    const toRollback = await this.db.find('_system_migrations', { 
      where: { batch },
      orderBy: { version: 'desc' }
    });

    const systemMigrations = loadMigrations();
    // For now, we only rollback system migrations that we have loaded.
    // In a full implementation, we'd need to collect plugin migrations too.

    for (const record of toRollback) {
      const migration = systemMigrations.find(m => m.version === record.version);
      if (migration && migration.down) {
        this.logger.info(`Rolling back: ${migration.name} (v${migration.version})...`);
        await migration.down(this.db, sql);
      }
      await this.db.delete('_system_migrations', { id: record.id });
    }

    this.logger.info('Rollback completed successfully.');
  }

  /**
   * Drops all tables in the database to allow a clean re-migration.
   * This is a destructive operation.
   */
  async reset() {
    const dialect = this.db.dialect;
    this.logger.warn(`Resetting database (${dialect})...`);

    if (dialect === 'postgres') {
      // For Postgres, the easiest way is to drop and recreate the public schema
      await this.db.execute(sql`DROP SCHEMA public CASCADE`);
      await this.db.execute(sql`CREATE SCHEMA public`);
      await this.db.execute(sql`GRANT ALL ON SCHEMA public TO public`);
      await this.db.execute(sql`COMMENT ON SCHEMA public IS 'standard public schema'`);
    } else if (dialect === 'sqlite') {
      // For SQLite, we get all tables and drop them
      await this.db.execute(sql`PRAGMA foreign_keys = OFF`);
      const tables: any = await this.db.execute(sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
      const rows = Array.isArray(tables) ? tables : (tables.rows || []);
      
      for (const row of rows) {
        const tableName = row.name || row.NAME;
        await this.db.execute(sql.raw(`DROP TABLE IF EXISTS "${tableName}"`));
      }
      await this.db.execute(sql`PRAGMA foreign_keys = ON`);
    } else if (dialect === 'mysql') {
      // For MySQL, we get all tables and drop them
      await this.db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
      const tables: any = await this.db.execute(sql`SHOW TABLES`);
      const rows = Array.isArray(tables) ? tables : (tables.rows || []);
      
      for (const row of rows) {
        const tableName = Object.values(row)[0] as string;
        await this.db.execute(sql.raw(`DROP TABLE IF EXISTS \`${tableName}\``));
      }
      await this.db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    }

    this.logger.info('Database reset completed.');
  }

  private async getMaxBatch(): Promise<number> {
    const result: any = await this.db.execute(sql`SELECT MAX(batch) as max_batch FROM _system_migrations`);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows[0]?.max_batch || rows[0]?.MAX_BATCH || 0;
  }
}
