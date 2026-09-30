import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginPermissionsService } from '@core/security/plugin-permissions-service';

/**
 * The deliberately small database surface a plugin migration may use on the schema-owner connection.
 *
 * Named schema operations (`database:schema`) and row reads/writes (`database:read`/`database:write`)
 * only — never raw SQL, which on this owner connection could read any table or switch row-level
 * security off (`database:raw` governs the plugin's request connection, not this one). Table-aware
 * helpers stay inside the plugin's physical namespace unless the operator also approved cross-plugin
 * schema access. Unknown manager properties never fall through to the raw owner connection.
 */
export class PluginSchemaDatabaseProxy {
  private static readonly TABLE_METHODS = new Set([
    'tableExists',
    'getColumns',
    'createTable',
    'addColumn',
    'ensureMigrationTable',
    // The schema repairs plugins used RAW SQL for, as named operations the framework validates and
    // runs. There is no `execute`: raw SQL on this owner connection could switch row-level security off.
    'ensurePointInTimeColumn',
    'repairTextIdPrimaryKey',
    'ensureTimestampDefault',
    'dropColumnDefault',
    'ensureDeclaredNullable',
    'createIndexIfMissing',
    'dropTableIfExists',
    'dropColumnIfExists',
    'copyColumnValues',
  ]);

  /**
   * Row reads and writes a DATA migration makes on its own tables, gated by the same capability the
   * plugin's runtime `context.db` uses — a migration gets no more than the plugin already has.
   */
  private static readonly DATA_METHODS = new Map<string, string>([
    ['find', 'database:read'],
    ['findOne', 'database:read'],
    ['count', 'database:read'],
    ['insert', 'database:write'],
    ['update', 'database:write'],
    ['delete', 'database:write'],
  ]);

  private static readonly SYSTEM_TABLES = new Set<string>(
    Object.values(SystemConstants.TABLE).map((table) => String(table).toLowerCase()),
  );

  static create(plugin: Pick<ILoadedPlugin, 'manifest'>, manager: IPluginManagerInterface): unknown {
    const ddl = (manager as any).schemaDb ?? manager.db;

    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        if (prop === 'dialect') {
          PluginSchemaDatabaseProxy.require(plugin, manager, 'database:schema');
          return ddl.dialect;
        }
        if (typeof prop === 'string' && PluginSchemaDatabaseProxy.TABLE_METHODS.has(prop)) {
          PluginSchemaDatabaseProxy.require(plugin, manager, 'database:schema');
          const method = ddl[prop];
          return (...args: unknown[]) => {
            PluginSchemaDatabaseProxy.assertTableAccess(plugin, manager, prop, args[0]);
            return method.apply(ddl, args);
          };
        }
        const dataCapability = typeof prop === 'string' ? PluginSchemaDatabaseProxy.DATA_METHODS.get(prop) : undefined;
        if (dataCapability) {
          PluginSchemaDatabaseProxy.require(plugin, manager, dataCapability);
          const method = ddl[prop as string];
          return (...args: unknown[]) => {
            PluginSchemaDatabaseProxy.assertTableAccess(plugin, manager, prop as string, args[0]);
            return method.apply(ddl, args);
          };
        }
        if (typeof prop === 'symbol') return undefined;
        throw new Error(`Security Violation: plugin "${plugin.manifest.slug}" cannot access schema database property "${String(prop)}".`);
      },
    });
  }

  private static require(plugin: Pick<ILoadedPlugin, 'manifest'>, manager: IPluginManagerInterface, capability: string): void {
    if (PluginPermissionsService.hasPermission(plugin.manifest, capability)) return;
    manager.audit.logAction(plugin.manifest.slug, 'Schema Capability Denied', capability, 'blocked');
    throw new Error(`Security Violation: plugin "${plugin.manifest.slug}" requires the explicitly approved "${capability}" capability.`);
  }

  private static assertTableAccess(
    plugin: Pick<ILoadedPlugin, 'manifest'>,
    manager: IPluginManagerInterface,
    method: string,
    tableOrCollection: unknown,
  ): void {
    const raw = typeof tableOrCollection === 'string'
      ? tableOrCollection
      : String((tableOrCollection as { slug?: unknown } | null)?.slug ?? '');
    const name = raw.trim().toLowerCase();
    if (!name) {
      throw new Error(`Security Violation: plugin "${plugin.manifest.slug}" called schema.${method} without a table.`);
    }

    const reference = PhysicalTableNameUtils.parse(name);
    const owner = reference?.pluginSlug ?? '';
    const system = name.startsWith('_system_') || PluginSchemaDatabaseProxy.SYSTEM_TABLES.has(name);
    const crossPlugin = owner.length > 0 && owner !== plugin.manifest.slug;
    if (!system && !crossPlugin) return;

    if (!PluginPermissionsService.hasPermission(plugin.manifest, 'database:schema:cross-plugin')) {
      manager.audit.logAction(plugin.manifest.slug, 'Schema Table Access Denied', name, 'blocked');
      throw new Error(
        `Security Violation: plugin "${plugin.manifest.slug}" cannot use schema.${method} on "${name}" without `
        + 'the explicitly approved "database:schema:cross-plugin" capability.',
      );
    }
  }
}
