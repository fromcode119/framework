import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { Logger } from '@core/logging';
import { MigrationCoordinator } from '@core/management/migration-coordinator';
import { PluginStateService } from '@core/plugin/services/plugin-state-service';
import { DiscoveryService } from '@core/plugin/services/discovery-service';
import { LifecycleService } from '@core/plugin/services/lifecycle-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/**
 * PluginDiscoveryCoordinatorService
 *
 * Orchestrates a discovery pass: scans plugins, records errored ones, resolves
 * dependency order, coordinates migrations, and registers each plugin. Extracted
 * from PluginManager to keep that class under the size limit; PluginManager keeps
 * its public discoverPlugins() entry point and delegates here with identical
 * behavior (it mutates the same plugins map passed in by reference).
 */
export class PluginDiscoveryCoordinatorService {
  constructor(
    private logger: Logger,
    private plugins: Map<string, ILoadedPlugin>,
    private registry: PluginStateService,
    private discovery: DiscoveryService,
    private coordinator: MigrationCoordinator,
    private lifecycle: LifecycleService,
  ) {}

  async discoverPlugins(): Promise<void> {
    const installedState = await this.registry.loadInstalledPluginsState();
    const { discovered, errored } = await this.discovery.discoverPlugins(this.plugins, installedState);

    // Add errored plugins to this.plugins
    for (const error of errored) {
      if (!this.plugins.has(error.manifest.slug)) {
        this.plugins.set(error.manifest.slug, {
          manifest: error.manifest,
          path: error.path,
          state: PluginState.ERROR,
          error: error.error,
          instanceId: `err-${error.manifest.slug}-${Date.now()}`
        } as any);
      }
    }

    try {
      const sorted = this.discovery.resolveDependencies(discovered.map(d => d.plugin));
      await this.coordinator.coordinate(sorted.map(p => p.manifest));

      for (const plugin of sorted) {
        const slug = plugin.manifest.slug;
        const stage = discovered.find(d => d.plugin.manifest.slug === slug);

        if (!stage) {
          this.logger.warn(`Plugin metadata found for ${slug} but path discovery failed.`);
          continue;
        }

        const existing = this.plugins.get(slug);
        if (existing && existing.state !== PluginState.ERROR) {
          continue;
        }

        try {
          await this.lifecycle.register(plugin, stage.path);
        } catch (err: any) {
          this.logger.error(`Failed to register plugin "${slug}": ${err.message}`);
          // Mark as errored in the local registry so it shows up in UI
          this.plugins.set(slug, {
            manifest: plugin.manifest,
            path: stage.path,
            state: PluginState.ERROR,
            error: err.message,
            instanceId: `err-reg-${slug}-${Date.now()}`
          } as any);
        }
      }

      // Final default-page materialization pass. The per-plugin pass (in `register`) can run before the
      // collection that OWNS pages (CMS's `pages`) is registered, so it skips ("no registered page
      // collection available") and required contract pages (e.g. /courses/:slug/learn, /instructors/:slug)
      // never get created. Running once more here — after EVERY plugin in the boot set is registered and its
      // collections are in the manager — guarantees the pages collection is present so all contracts materialize.
      await this.lifecycle.materializeDefaultPagesFinalPass();

      // One consolidated admin alert for anything held/errored this pass (never mid-loop).
      await this.lifecycle.reportBootPluginHealth();
    } catch (err: any) {
      this.logger.error(`Plugin discovery coordination failed: ${err.message}`);
    }
  }
}
