import { Logger } from '@core/logging';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginSchemaDatabaseProxy } from '@core/plugin/context/plugin-schema-database-proxy';

/**
 * Runs a plugin's schema migrations on the framework's DDL connection.
 *
 * Plugins used to execute their own migrations through `context.db`, which worked only because the
 * application connected as the schema OWNER. Under least privilege the request connection is a
 * non-owner role — it cannot `ALTER TABLE`, and every plugin doing boot-time DDL broke with
 * "must be owner of table …".
 *
 * The fix is not to hand plugins owner rights. The FRAMEWORK owns the DDL connection and runs the
 * migration on their behalf: a plugin says what to migrate, never which connection to use. Each run
 * is audited, so schema changes made this way are attributable to the plugin that asked for them.
 */
export class MigrationsContextProxy {
  private static readonly logger = new Logger({ namespace: 'plugin-migrations' });

  static createMigrationsProxy(plugin: ILoadedPlugin, manager: IPluginManagerInterface) {
    const slug = plugin.manifest.slug;

    return {
      /**
       * Run one or more migration objects against the DDL connection, in order.
       *
       * Each must expose `up(db)`. They are expected to be repeat-safe (createTableIfMissing /
       * addColumnIfMissing), because this path is typically called from `onInit` on every boot.
       */
      async run(migrations: Array<{ up: (db: any) => Promise<void> }>): Promise<void> {
        const list = Array.isArray(migrations) ? migrations : [migrations];
        const ddl = PluginSchemaDatabaseProxy.create(plugin, manager);

        for (const migration of list) {
          const name = migration?.constructor?.name || 'anonymous';
          try {
            await migration.up(ddl);
          } catch (error: any) {
            MigrationsContextProxy.logger.error(
              `[${slug}] migration ${name} failed: ${error?.message || error}`,
            );
            throw error;
          }
        }

        manager.audit.logAction(slug, 'Plugin Migrations Run', `${list.length} migration(s)`, 'allowed');
      },
    };
  }
}
