import { LoadedPlugin } from '../../types';
import { Logger } from '../../logging';
import { MigrationCoordinator } from '../../management/migration-coordinator';
import { PluginStateService } from './plugin-state-service';
import { DiscoveryService } from './discovery-service';
import { LifecycleService } from './lifecycle-service';

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
    private plugins: Map<string, LoadedPlugin>,
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
          state: 'error',
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
        if (existing && existing.state !== 'error') {
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
            state: 'error',
            error: err.message,
            instanceId: `err-reg-${slug}-${Date.now()}`
          } as any);
        }
      }
    } catch (err: any) {
      this.logger.error(`Plugin discovery coordination failed: ${err.message}`);
    }
  }
}
