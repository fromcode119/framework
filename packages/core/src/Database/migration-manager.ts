import { IDatabaseManager, sql } from '@fromcode/database';
import { Logger } from '@fromcode/sdk';
import { SystemMigration } from '../types';
import { loadMigrations } from './migrations';
import { SystemTable } from '@fromcode/sdk/internal';

export class MigrationManager {
  private logger = new Logger({ namespace: 'migration-manager' });

  constructor(private db: IDatabaseManager) {}

  async init() {
    await this.db.ensureMigrationTable(SystemTable.MIGRATIONS);
  }

  async migrate(pluginMigrations: SystemMigration[] = []) {
    await this.init();
    const systemMigrations = loadMigrations();
    const allMigrations = [...systemMigrations, ...pluginMigrations];
    
    const executed = await this.db.find(SystemTable.MIGRATIONS, { columns: { version: true } });
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
      await this.db.insert(SystemTable.MIGRATIONS, {
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

    const toRollback = await this.db.find(SystemTable.MIGRATIONS, { 
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
      await this.db.delete(SystemTable.MIGRATIONS, { id: record.id });
    }

    this.logger.info('Rollback completed successfully.');
  }

  /**
   * Drops all tables in the database to allow a clean re-migration.
   * This is a destructive operation.
   */
  async reset() {
    this.logger.warn(`Resetting database...`);
    await this.db.resetDatabase();
    this.logger.info('Database reset completed.');
  }

  private async getMaxBatch(): Promise<number> {
    const result: any = await this.db.execute(sql`SELECT MAX(batch) as max_batch FROM _system_migrations`);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows[0]?.max_batch || rows[0]?.MAX_BATCH || 0;
  }
}
