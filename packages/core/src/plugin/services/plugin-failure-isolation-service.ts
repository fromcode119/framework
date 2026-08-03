import { Logger } from '@core/logging';
import { CoreServices } from '@core/services/core-services';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { PluginStateService } from '@core/plugin/services/plugin-state-service';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class PluginFailureIsolationService {
  constructor(
    private manager: IPluginManagerInterface,
    private registry: PluginStateService,
    private logger: Logger,
  ) {}

  async markPluginError(plugin: ILoadedPlugin, message: string): Promise<void> {
    // In-memory state is 'error' so runtime filters/gates exclude the broken plugin and
    // the admin UI shows it as failed. The DB only records health='error' and PRESERVES the
    // desired `state` column, so the plugin recovers to exactly where it was (active stays
    // active, inactive stays inactive) on the next clean boot, instead of being stuck.
    plugin.state = PluginState.ERROR;
    plugin.error = message;
    plugin.healthStatus = PluginRegistryHealth.ERROR;
    await this.registry.markPluginHealthError(plugin.manifest.slug);
    await this.registry.writeLog('ERROR', `Plugin "${plugin.manifest.slug}" failed: ${message}`, plugin.manifest.slug);
  }

  rollbackPartialRegistration(plugin: ILoadedPlugin): void {
    this.manager.plugins.delete(plugin.manifest.slug);
    this.manager.headInjections.delete(plugin.manifest.slug);

    for (const [collectionSlug, entry] of this.manager.registeredCollections.entries()) {
      if (entry.pluginSlug === plugin.manifest.slug) {
        this.manager.registeredCollections.delete(collectionSlug);
      }
    }

    const pluginNamespace = String(plugin.manifest.namespace || '').trim();
    if (pluginNamespace) {
      CoreServices.getInstance().defaultPageContracts.unregisterByPlugin(
        pluginNamespace,
        plugin.manifest.slug,
      );
    }
  }
}
