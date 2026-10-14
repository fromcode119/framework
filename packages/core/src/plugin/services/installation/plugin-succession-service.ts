import fs from 'fs';
import path from 'path';
import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import type { IDatabaseManager } from '@fromcode119/database';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { ProjectPaths } from '@core/config/paths';
import { Logger } from '@core/logging';

/**
 * A plugin taking over from the plugin it was renamed from.
 *
 * A manifest that says `"replaces": ["old-slug"]` is the same product under a new name. Before the new
 * slug is registered or migrated for the first time, everything the platform keeps under the old one is
 * moved to it: the plugin's tables (`fcp_<old>_*` → `fcp_<new>_*`, with their indexes and policies), its
 * registry row — and with it, through the foreign keys, its settings on every site and its scheduled
 * tasks — which sites have it switched on, its migration ledger, and the permissions roles hold on it.
 * The plugin then boots as an UPDATE of what was there, approved as it was, with every row it had.
 *
 * It runs once: a new slug that already has a registry row has taken over (or never needed to), and an
 * old slug with no row has nothing to hand on. The data moves inside one transaction, so a failure
 * leaves the old plugin exactly as it was.
 */
export class PluginSuccessionService {
  private static readonly logger = new Logger({ namespace: 'plugin-succession' });

  /**
   * @param retire stops a running plugin of the old name in this process without recording anything, so
   * a hot install does not move its tables out from under requests it is still answering.
   */
  constructor(private readonly db: IDatabaseManager, private readonly retire: (slug: string) => Promise<void> = async () => undefined) {}

  /**
   * The slugs the plugins in ONE plugin root say they replace, read from each `manifest.json` before
   * anything is staged. Per root, because a root is one owner's (the platform's, or one site's): a plugin
   * can only keep a plugin of its own owner from loading, never another site's or the platform's.
   */
  static replacedOnDisk(root: string): Set<string> {
    const replaced = new Set<string>();
    let dirs: string[] = [];
    try { dirs = fs.readdirSync(root); } catch { return replaced; }
    for (const dir of dirs) {
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, dir, 'manifest.json'), 'utf8')) as IPluginManifest;
        for (const slug of manifest.replaces ?? []) if (slug !== manifest.slug) replaced.add(slug);
      } catch {
        // Not a plugin directory, or one whose manifest the scanner reports on its own.
      }
    }
    return replaced;
  }

  private static sameOwner(a: unknown, b: unknown): boolean {
    return String(a ?? '').trim() === String(b ?? '').trim();
  }

  /** Moves whatever `manifest` replaces onto its slug; a no-op for every manifest without `replaces`. */
  async adopt(manifest: IPluginManifest): Promise<string[]> {
    const adopted: string[] = [];
    for (const predecessor of manifest.replaces ?? []) {
      if (predecessor === manifest.slug) continue;
      if (await this.take(predecessor, manifest)) adopted.push(predecessor);
    }
    return adopted;
  }

  private async take(from: string, manifest: IPluginManifest): Promise<boolean> {
    const to = manifest.slug;
    if (PluginSuccessionService.installed(await this.db.findOne(SystemConstants.TABLE.PLUGINS, { slug: to }))) return false;
    await this.retire(from);
    const tables = await this.db.withExclusiveLock(`plugin-succession:${from}`, async () => {
      const placeholder = await this.db.findOne(SystemConstants.TABLE.PLUGINS, { slug: to });
      if (PluginSuccessionService.installed(placeholder)) return null;
      const predecessor = await this.db.findOne(SystemConstants.TABLE.PLUGINS, { slug: from });
      if (!predecessor) return null;
      // Only the same owner's plugin: a site's plugin may succeed that site's plugin, a platform plugin a
      // platform plugin. A manifest is written by whoever uploads it, so without this one site's upload
      // could declare it replaces a platform plugin and take its tables.
      if (!PluginSuccessionService.sameOwner(predecessor.owner_tenant_id, (manifest as { ownerTenantId?: string }).ownerTenantId)) {
        PluginSuccessionService.logger.warn(`"${to}" says it replaces "${from}", which another owner installed; nothing was moved.`);
        return null;
      }
      // Staging the new plugin's sandbox already wrote a row holding only its isolation user; the old
      // row, with its version, approvals and its own user, is the one that carries on.
      if (placeholder) await this.db.delete(SystemConstants.TABLE.PLUGINS, { slug: to });
      const moved = await this.moveTables(from, to);
      await this.db.update(SystemConstants.TABLE.PLUGINS, { slug: from }, { slug: to });
      // Postgres carries these along by the cascading foreign key; an engine that does not enforce one leaves them to us.
      await this.db.update(SystemConstants.TABLE.PLUGIN_SETTINGS, { plugin_slug: from }, { plugin_slug: to });
      await this.db.update(SystemConstants.TABLE.SCHEDULER_TASKS, { plugin_slug: from }, { plugin_slug: to });
      await this.db.update(SystemConstants.TABLE.TENANT_PLUGINS, { plugin_slug: from }, { plugin_slug: to });
      await this.db.update(SystemConstants.TABLE.PERMISSIONS, { plugin_slug: from }, { plugin_slug: to });
      await this.db.update(SystemConstants.TABLE.ROLES, { plugin_slug: from }, { plugin_slug: to });
      await this.renameKeys(SystemConstants.TABLE.MIGRATIONS, 'name', `plugin:${from}:`, `plugin:${to}:`);
      await this.renameKeys(SystemConstants.TABLE.SCHEDULER_TASKS, 'name', `${from}:`, `${to}:`);
      await this.renameKeys(SystemConstants.TABLE.PERMISSIONS, 'name', `${from}:`, `${to}:`);
      await this.renamePermissions(SystemConstants.TABLE.ROLES, from, to);
      return moved;
    });
    if (!tables) return false;
    await this.moveSiteRows(from, to);
    this.moveDataDirectory(from, to, (manifest as { ownerTenantId?: string }).ownerTenantId);
    PluginSuccessionService.logger.info(`"${to}" took over from "${from}": ${tables.length} table(s) and the registry moved.`);
    return true;
  }

  /** `fcp_<from>_*` → `fcp_<to>_*`, leaving alone a table of another plugin whose slug only begins like the old one. */
  private async moveTables(from: string, to: string): Promise<string[]> {
    const oldPrefix = PhysicalTableNameUtils.createPluginPrefix(from);
    const newPrefix = PhysicalTableNameUtils.createPluginPrefix(to);
    const others = (await this.db.find(SystemConstants.TABLE.PLUGINS, {}))
      .map((row: Record<string, unknown>) => PhysicalTableNameUtils.createPluginPrefix(String(row.slug)))
      .filter((prefix: string) => prefix !== oldPrefix && prefix.startsWith(oldPrefix));
    const tables = (await this.db.getTables())
      .filter((table) => table.startsWith(oldPrefix) && !others.some((prefix: string) => table.startsWith(prefix)));
    for (const table of tables) await this.db.renameTable(table, newPrefix + table.slice(oldPrefix.length));
    return tables;
  }

  /** Rows of `table` whose `column` begins with `from`, rewritten to begin with `to`. */
  private async renameKeys(table: string, column: string, from: string, to: string): Promise<void> {
    const rows = await this.db.find(table, { search: { columns: [column], value: from } });
    for (const row of rows) {
      const value = String(row[column] ?? '');
      if (value.startsWith(from)) await this.db.update(table, { [column]: value }, { [column]: to + value.slice(from.length) });
    }
  }

  /** A role's permissions named after the plugin (`<slug>:manage`, `<slug>:<collection>:<action>`, `<slug>:*`). */
  private async renamePermissions(table: string, from: string, to: string): Promise<void> {
    for (const row of await this.db.find(table, {})) {
      const permissions = PluginSuccessionService.list(row.permissions);
      if (!permissions.some((name) => name.startsWith(`${from}:`))) continue;
      const renamed = permissions.map((name) => (name.startsWith(`${from}:`) ? `${to}:${name.slice(from.length + 1)}` : name));
      await this.db.update(table, { id: row.id }, { permissions: renamed });
    }
  }

  /**
   * What each site keeps under row-level security — its own roles' permissions, its records' edit history
   * and the schema notes the platform keeps per table — moved inside that scope, where the rows can be seen.
   */
  private async moveSiteRows(from: string, to: string): Promise<void> {
    const oldPrefix = PhysicalTableNameUtils.createPluginPrefix(from);
    const newPrefix = PhysicalTableNameUtils.createPluginPrefix(to);
    const sites = (await this.db.find(SystemConstants.TABLE.TENANT_PLUGINS, { where: { plugin_slug: to } }))
      .map((row: Record<string, unknown>) => String(row.tenant_id));
    for (const site of new Set(sites)) {
      await this.db.withTenant(site, async () => {
        await this.renamePermissions(SystemConstants.TABLE.SITE_ROLES, from, to);
        // A record's edit history is filed under its physical table.
        await this.renameKeys(SystemConstants.TABLE.RECORD_VERSIONS, 'ref_collection', oldPrefix, newPrefix);
      });
    }
    await this.db.withPlatformAdmin(async () => {
      for (const kind of ['entity_schema:', 'schema_orphan:']) {
        await this.renameKeys(SystemConstants.TABLE.META, 'key', kind + oldPrefix, kind + newPrefix);
      }
    });
  }

  /** The plugin's own files (`data/plugins/<slug>`), when it kept any. */
  private moveDataDirectory(from: string, to: string, ownerTenantId?: string | null): void {
    const source = ProjectPaths.getPluginDataDir(from, undefined, ownerTenantId);
    const target = ProjectPaths.getPluginDataDir(to, undefined, ownerTenantId);
    if (fs.existsSync(source) && !fs.existsSync(target)) fs.renameSync(source, target);
  }

  /** A registry row of a plugin that has been installed — not the placeholder sandbox staging writes first. */
  private static installed(row: Record<string, unknown> | null): boolean {
    return Boolean(row && String(row.version ?? '').trim());
  }

  private static list(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
}
