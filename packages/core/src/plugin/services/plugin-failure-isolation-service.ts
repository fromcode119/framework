import { Logger } from '../../logging';
import { CoreServices } from '../../services/core-services';
import { LoadedPlugin } from '../../types';
import type { PluginManagerInterface } from '../context/utils.interfaces';
import { PluginStateService } from './plugin-state-service';

export class PluginFailureIsolationService {
  constructor(
    private manager: PluginManagerInterface,
    private registry: PluginStateService,
    private logger: Logger,
  ) {}

  async markPluginError(plugin: LoadedPlugin, message: string): Promise<void> {
    // In-memory state is 'error' so runtime filters/gates exclude the broken plugin and
    // the admin UI shows it as failed. The DB only records health='error' and PRESERVES the
    // desired `state` column, so the plugin recovers to exactly where it was (active stays
    // active, inactive stays inactive) on the next clean boot, instead of being stuck.
    plugin.state = 'error';
    plugin.error = message;
    plugin.healthStatus = 'error';
    await this.registry.markPluginHealthError(plugin.manifest.slug);
    await this.registry.writeLog('ERROR', `Plugin "${plugin.manifest.slug}" failed: ${message}`, plugin.manifest.slug);
  }

  rollbackPartialRegistration(plugin: LoadedPlugin): void {
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
