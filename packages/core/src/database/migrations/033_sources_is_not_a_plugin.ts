import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { Logger } from '../../logging';

/**
 * Removes the plugin REGISTRATION for Sources, which is no longer a plugin.
 *
 * Migration 031 renamed the row from `build-server` to `sources` so the extension's data survived the
 * rename. This one deletes that row, because Sources became framework code: there is no manifest to
 * read, no archive on disk, and nothing for the plugin manager to load.
 *
 * Leaving it was not harmless. The plugin manager reported an ACTIVE plugin whose files did not
 * exist, so the admin asked the api for its UI bundle and stylesheet on every page load and routed
 * `/sources` at the plugin slot system — which shadowed the real framework screen with a plugin
 * screen that could never load. The symptom was a blank page, and nothing said why.
 *
 * The builds table is NOT touched. That is the operator's data — tracked repositories, branches,
 * tokens, build history — and it now belongs to the framework (migration 032).
 */
export class SourcesIsNotAPluginMigration extends BaseMigration {
  readonly version = 33;
  readonly name = 'Sources is framework code, so it has no plugin registration';

  private static readonly SLUG = 'sources';
  private static readonly logger = new Logger({ namespace: 'SourcesIsNotAPluginMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    if (!(await this.tableExists(db, '_system_plugins'))) return;

    // Settings first: they are keyed by plugin slug with a foreign key to the row below, and the
    // only one Sources ever declared was its workspace path, which the framework now resolves.
    if (await this.tableExists(db, '_system_plugin_settings')) {
      await db.execute(sql.raw(
        `DELETE FROM _system_plugin_settings WHERE plugin_slug = '${SourcesIsNotAPluginMigration.SLUG}'`,
      ));
    }

    // The scheduler re-registers its task on every boot under the same name, so the row is rebuilt.
    // It has to go first regardless: it references the plugin row being deleted.
    if (await this.tableExists(db, '_system_scheduler_tasks')) {
      await db.execute(sql.raw(
        `DELETE FROM _system_scheduler_tasks WHERE plugin_slug = '${SourcesIsNotAPluginMigration.SLUG}'`,
      ));
    }

    await db.execute(sql.raw(
      `DELETE FROM _system_plugins WHERE slug = '${SourcesIsNotAPluginMigration.SLUG}'`,
    ));
    SourcesIsNotAPluginMigration.logger.info(
      'Removed the Sources plugin registration; it is framework code now.',
    );
  }

  private async tableExists(db: IDatabaseManager, table: string): Promise<boolean> {
    let present = false;
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SourcesIsNotAPluginMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM pg_class WHERE relname = '${table}'`)),
        );
      },
      sqlite: async () => {
        present = SourcesIsNotAPluginMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = '${table}'`)),
        );
      },
    });
    return present;
  }

  private static hasRow(result: unknown): boolean {
    const list = (result as { rows?: unknown[] })?.rows ?? (result as unknown[]);
    return Array.isArray(list) ? list.length > 0 : Boolean(list);
  }
}
