import type { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';

/**
 * The set of plugin slugs this platform has a `_system_plugins` row for — read straight from that
 * table, never from `PluginManager.getPlugins()` (the in-memory, currently-loaded set).
 *
 * `TenantImportExecutor` filters `_system_plugin_settings` rows against this same query at import
 * time, so the planner's preview must read it the same way: a plugin whose row exists but which
 * failed to load (or was installed by another process since this one booted) is still "installed"
 * for that filter, and a preview built from the loaded set alone would disagree with what the
 * executor actually does.
 */
export class TenantInstalledPluginSlugs {
  static async read(db: IDatabaseManager): Promise<Set<string>> {
    const rows = await db.queryRaw(`SELECT slug FROM ${TenantSql.identifier(SystemConstants.TABLE.PLUGINS)}`);
    return new Set(rows.map((row) => String(row.slug)));
  }
}
