import { PluginMigrationLoader } from '@core/database/plugin-migration-loader';
import type { MigrationManager } from '@core/database/migration-manager';
import type { IDatabaseManager } from '@core/interfaces/database-manager.interface';
import type { ISystemMigration } from '@core/interfaces/system-migration.interface';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';

/**
 * Runs a plugin's own migrations — on that plugin's `PluginSchemaDatabaseProxy`, never the owner connection.
 *
 * The runner (`MigrationManager`) holds the schema-OWNER connection and hands it to every migration it
 * runs. That is right for the framework's own migrations and wrong for a plugin's: on the owner
 * connection a plugin could read any table, write another plugin's rows, or switch row-level security
 * off. Each plugin migration is rebound so that, whatever the runner passes, it receives the proxy:
 * its own tables, its declared capabilities.
 */
export class PluginMigrationRunner {
  constructor(
    private readonly migrationManager: MigrationManager,
    private readonly migrationDatabaseFor: (manifest: IPluginManifest) => IDatabaseManager,
  ) {}

  async run(slug: string, pluginPath: string, manifest: IPluginManifest, progressReporter?: IPluginInstallProgressReporter): Promise<void> {
    progressReporter?.({ phase: 'checking-migrations', message: `Checking migrations for "${slug}"...`, pluginSlug: slug });

    const pluginMigrations = await PluginMigrationLoader.load(slug, pluginPath, manifest.migrations);
    if (pluginMigrations.length === 0) {
      progressReporter?.({ phase: 'checking-migrations', message: `No plugin migrations found for "${slug}".`, pluginSlug: slug });
      return;
    }

    const db = this.migrationDatabaseFor(manifest);
    await this.migrationManager.migrate(PluginMigrationRunner.bind(pluginMigrations, db), progressReporter);
  }

  static bind(migrations: ISystemMigration[], db: IDatabaseManager): ISystemMigration[] {
    return migrations.map((migration) => {
      const down = migration.down;
      return {
        ...migration,
        up: (_owner, sqlTag, tenants) => migration.up(db, sqlTag, tenants),
        down: down ? (_owner, sqlTag) => down(db, sqlTag) : undefined,
      };
    });
  }
}
