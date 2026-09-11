import fs from 'fs';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import path from 'path';
import { Logger } from '@core/logging';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { PluginPermissionsService } from '@core/security/plugin-permissions-service';
import { PluginPermission } from '@core/security/enums/plugin-permission.enum';
import { SchemaManager } from '@core/database/schema-manager';
import { Seeder } from '@core/database/seeder';
import { TenantMode } from '@core/tenant/tenant-mode';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginDefaultPageMaterializationRuntimeService } from '@core/services/default-page-contract/plugin-default-page-materialization-runtime-service';

/**
 * PluginCollectionActivationService
 *
 * Activation-time side effects for a plugin: auto-discovering JSON collections,
 * syncing collection schemas, running seeds, and materializing default pages.
 * Extracted from LifecycleService to keep that class under the size limit; the
 * lifecycle delegates these steps here with identical behavior.
 */
export class PluginCollectionActivationService {
  constructor(
    private manager: IPluginManagerInterface,
    private schemaManager: SchemaManager,
    private seeder: Seeder,
    private logger: Logger,
  ) {}

  /**
   * Runs a plugin's declared seed data.
   *
   * A plugin's seed writes into that plugin's own tables, which are tenant-scoped — so on a multi-tenant
   * platform it is PER-SITE work, and boot has no site. Attempting it anyway is what produced
   * "new row violates row-level security policy" on every restart: the write is correctly refused, the
   * plugin reports a failure, and nothing is seeded for anyone. It is skipped here and run per site by
   * `materializePages`, which already holds a tenant scope, so a site gets its seed at creation and
   * whenever the operator rebuilds its pages.
   *
   * Single-tenant deployments are unchanged: there is one scope, and it is always in effect.
   */
  public async runSeeds(slug: string): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin || !plugin.manifest.seeds || !plugin.path) return;

    if (TenantMode.isEnabled() && !RequestContextUtils.getTenantId()) {
      this.logger.info(
        `Skipping seeds for plugin "${slug}": this deployment is multi-tenant and boot has no site. `
        + 'They run per site — at creation, or from Sites → Rebuild pages.',
      );
      return;
    }

    const seedPath = path.resolve(plugin.path, plugin.manifest.seeds);
    if (fs.existsSync(seedPath)) {
      this.logger.info(`Running seeds for plugin "${slug}"...`);
      try {
        await this.seeder.seed(seedPath);
      } catch (err: any) {
        this.logger.error(`Failed to run seeds for plugin "${slug}": ${err.message}`);
      }
    }
  }

  /**
   * @param ownerPluginSlug the plugin being activated. Its own required routes still fail it — that is
   * the guarantee the `required` flag buys. Another plugin's broken route is logged and stepped over:
   * activation runs this for every plugin in turn, so rethrowing an unrelated failure took down the
   * registration of every plugin after it and left the site serving nothing. Omit the slug for a pass
   * that belongs to no single plugin; those failures are reported, never thrown.
   */
  public async materializeDefaultPages(ownerPluginSlug?: string): Promise<void> {
    try {
      const service = new PluginDefaultPageMaterializationRuntimeService(
        this.manager,
        async () => {
          return await (this.manager.themeManager as any)?.getActiveThemeDefaultPageContractOverrides?.() || [];
        },
      );
      // Once per tenant when there is no request to borrow one from. CMS pages are tenant-scoped, so
      // materialising at boot wrote rows with a NULL `tenant_id` that row-level security refuses —
      // every site's default pages silently failed to appear, thirty refusals per boot.
      if (RequestContextUtils.storage.getStore()) {
        await service.materialize(ownerPluginSlug);
      } else {
        await PerTenantRun.forEach({
          label: `cms:materialize-default-pages${ownerPluginSlug ? `:${ownerPluginSlug}` : ''}`,
          db: this.manager.db as any,
          work: async () => { await service.materialize(ownerPluginSlug); },
        });
      }
    } catch (error: any) {
      if (PluginDefaultPageMaterializationRuntimeService.isRequiredRouteFailure(error)) {
        if (ownerPluginSlug) {
          throw error;
        }
        this.logger.error(`Default page materialization reported unreconciled required routes: ${error?.message || error}`);
        return;
      }
      this.logger.warn(`Default page materialization failed: ${error?.message || error}`);
    }
  }

  public async autoDiscoverCollections(plugin: ILoadedPlugin, ctx: any): Promise<void> {
    if (!plugin.path) return;
    const collectionsDir = path.join(plugin.path, 'src', 'collections');
    if (!fs.existsSync(collectionsDir)) return;
    const files = fs.readdirSync(collectionsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(collectionsDir, file), 'utf8'));
        if (raw?.slug && Array.isArray(raw?.fields)) {
          ctx.collections.register(raw);
          this.logger.debug(`Auto-discovered collection "${raw.slug}" from ${file} in plugin "${plugin.manifest.slug}"`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to auto-load collection from "${file}" in plugin "${plugin.manifest.slug}": ${err.message}`);
      }
    }
  }

  /**
   * Post-delete cleanup: clear the plugin's require cache, drop its registered
   * collections, and remove its files from disk. Best-effort; failures are logged.
   */
  public cleanupAfterDelete(slug: string, pluginPath: string | undefined, mainEntry: string): void {
    if (pluginPath) {
      try {
        const indexPath = path.resolve(pluginPath, mainEntry || 'index.js');
        const resolved = require.resolve(indexPath);
        if (require.cache[resolved]) delete require.cache[resolved];
      } catch (e) {
        this.logger.warn(`Failed to clear require cache for plugin "${slug}": ${(e as Error).message}`);
      }
    }

    for (const [colSlug, entry] of this.manager.registeredCollections.entries()) {
      if (entry.pluginSlug === slug) this.manager.registeredCollections.delete(colSlug);
    }

    try {
      if (pluginPath && fs.existsSync(pluginPath)) {
        fs.rmSync(pluginPath, { recursive: true, force: true });
      }
    } catch (e) {
      this.logger.warn(`Failed to remove plugin files for "${slug}": ${(e as Error).message}`);
    }
  }

  public async syncPluginCollections(pluginSlug: string): Promise<void> {
    const plugin = this.manager.plugins.get(pluginSlug);
    if (!plugin) return;

    const pluginCollections = Array.from(this.manager.registeredCollections.values())
      .filter(entry => entry.pluginSlug === pluginSlug);

    if (pluginCollections.length > 0) {
      PluginPermissionsService.ensure(pluginSlug, plugin.manifest, PluginPermission.DATABASE_WRITE);
      for (const { collection } of pluginCollections) {
        await this.schemaManager.syncCollection(collection);
      }
    }
  }
}
