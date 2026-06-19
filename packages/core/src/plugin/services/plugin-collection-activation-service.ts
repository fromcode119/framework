import fs from 'fs';
import path from 'path';
import { Logger } from '../../logging';
import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from '../context/utils.interfaces';
import { PluginPermissionsService } from '../../security/plugin-permissions-service';
import { SchemaManager } from '../../database/schema-manager';
import { Seeder } from '../../database/seeder';
import { PluginDefaultPageMaterializationRuntimeService } from '../../services/default-page-contract/plugin-default-page-materialization-runtime-service';

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
    private manager: PluginManagerInterface,
    private schemaManager: SchemaManager,
    private seeder: Seeder,
    private logger: Logger,
  ) {}

  public async runSeeds(slug: string): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin || !plugin.manifest.seeds || !plugin.path) return;

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

  public async materializeDefaultPages(): Promise<void> {
    try {
      const service = new PluginDefaultPageMaterializationRuntimeService(
        this.manager,
        async () => {
          return await (this.manager.themeManager as any)?.getActiveThemeDefaultPageContractOverrides?.() || [];
        },
      );
      await service.materialize();
    } catch (error: any) {
      if (PluginDefaultPageMaterializationRuntimeService.isRequiredRouteFailure(error)) {
        throw error;
      }
      this.logger.warn(`Default page materialization failed: ${error?.message || error}`);
    }
  }

  public async autoDiscoverCollections(plugin: LoadedPlugin, ctx: any): Promise<void> {
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
      PluginPermissionsService.ensure(pluginSlug, plugin.manifest, 'database:write');
      for (const { collection } of pluginCollections) {
        await this.schemaManager.syncCollection(collection);
      }
    }
  }
}
