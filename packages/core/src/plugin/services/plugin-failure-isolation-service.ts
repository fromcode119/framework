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
    plugin.state = 'error';
    plugin.error = message;
    plugin.healthStatus = 'error';
    await this.registry.savePluginState(
      plugin.manifest.slug,
      'error',
      plugin.approvedCapabilities,
      plugin.manifest.version,
    );
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
