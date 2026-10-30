import { PhysicalTableNameUtils } from '@fromcode119/database';
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

  /**
   * `firstInstall`: the plugin was not installed before. When none of its tables exists yet, its migrations
   * are recorded as applied instead of run: the tables are created afterwards, at their current shape,
   * when it is enabled — run now, a migration reading one fails the install (`relation "fcp_<slug>_…" does
   * not exist`), and a failed attempt leaves the migrations that did pass in the ledger. Over tables that
   * are already there (a reinstall that kept its data, an adopted predecessor's) they run as on an update.
   */
  async run(slug: string, pluginPath: string, manifest: IPluginManifest, progressReporter?: IPluginInstallProgressReporter, firstInstall = false): Promise<void> {
    progressReporter?.({ phase: 'checking-migrations', message: `Checking migrations for "${slug}"...`, messageKey: 'checkingMigrations', messageParams: { pluginSlug: slug }, pluginSlug: slug });

    const pluginMigrations = await PluginMigrationLoader.load(slug, pluginPath, manifest.migrations);
    if (pluginMigrations.length === 0) {
      progressReporter?.({ phase: 'checking-migrations', message: `No plugin migrations found for "${slug}".`, messageKey: 'noMigrations', messageParams: { pluginSlug: slug }, pluginSlug: slug });
      return;
    }

    if (firstInstall && !(await this.migrationManager.hasTablesWithPrefix(PhysicalTableNameUtils.createPluginPrefix(slug)))) {
      const recorded = await this.migrationManager.recordApplied(pluginMigrations);
      progressReporter?.({
        phase: 'checking-migrations',
        message: `First install of "${slug}": ${recorded} migration(s) recorded as applied; its tables are created at their current shape.`,
        messageKey: 'firstInstallMigrationsRecorded',
        messageParams: { pluginSlug: slug, count: recorded },
        pluginSlug: slug,
      });
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
