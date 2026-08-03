import { SystemConstants } from '@core/constants/system.constants';
import { Logger } from '@core/logging';
import { PluginStateService } from '@core/plugin/services/plugin-state-service';
import type { ICollection } from '@core/interfaces/collection.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class PluginRuntimeStateService {
  constructor(
    private readonly logger: Logger,
    private readonly db: any,
    private readonly registry: PluginStateService,
    private readonly plugins: Map<string, ILoadedPlugin>,
    private readonly headInjections: Map<string, any[]>,
    private readonly registeredCollections: Map<string, { collection: ICollection; pluginSlug: string }>,
    private readonly pluginSettings: Map<string, any>,
  ) {}

  async savePluginConfig(slug: string, config: any): Promise<void> {
    await this.registry.savePluginConfig(slug, config);
    const plugin = this.plugins.get(slug);
    if (plugin) {
      plugin.manifest.config = config;
    }
  }

  async saveSandboxConfig(slug: string, config: any): Promise<void> {
    const { systemPlugins } = require('@fromcode119/database');
    const isExplicitlyDisabled = config === false || (config && typeof config === 'object' && config.enabled === false);
    const normalizedConfig = isExplicitlyDisabled
      ? false
      : (config && typeof config === 'object'
          ? Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'enabled'))
          : {});

    await this.db.update(systemPlugins, { slug }, {
      sandboxConfig: normalizedConfig,
    });

    const plugin = this.plugins.get(slug);
    if (plugin) {
      if (normalizedConfig === false) {
        plugin.manifest.sandbox = false;
      } else if (!plugin.manifest.sandbox || typeof plugin.manifest.sandbox === 'boolean') {
        plugin.manifest.sandbox = normalizedConfig;
      } else {
        plugin.manifest.sandbox = { ...plugin.manifest.sandbox, ...normalizedConfig };
      }
    }

    this.logger.info(`Sandbox configuration updated for plugin: ${slug}`);
  }

  getHeadInjections(slug: string): any[] {
    return this.headInjections.get(slug.toLowerCase()) || [];
  }

  getCollections(): ICollection[] {
    return Array.from(this.registeredCollections.values()).map((entry) => entry.collection);
  }

  getCollection(slug: string): { collection: ICollection; pluginSlug: string } | undefined {
    const entry = this.registeredCollections.get(slug);
    if (entry) {
      return entry;
    }

    const lowerSlug = slug.toLowerCase();
    for (const [key, value] of this.registeredCollections.entries()) {
      if (key.toLowerCase() === lowerSlug) {
        return value;
      }
    }

    return undefined;
  }

  registerPluginSettings(pluginSlug: string, schema: any): void {
    this.pluginSettings.set(pluginSlug.toLowerCase(), schema);
    this.logger.info(`Settings registered for plugin: ${pluginSlug}`);
  }

  getPluginSettings(pluginSlug: string): any | undefined {
    return this.pluginSettings.get(pluginSlug.toLowerCase());
  }

  getAllPluginSettings(): Map<string, any> {
    return new Map(this.pluginSettings);
  }

  async disableWithError(slug: string): Promise<void> {
    const plugin = this.plugins.get(slug);
    if (!plugin) {
      return;
    }

    // In-memory state goes 'error' (runtime excludes it); the DB only flips health to
    // 'error' and KEEPS the desired `state` column so the plugin recovers to its prior
    // active/inactive state on the next clean boot instead of being stuck in error.
    plugin.state = PluginState.ERROR;
    await this.db.update(SystemConstants.TABLE.PLUGINS, { slug }, {
      health_status: 'error',
      updated_at: new Date(),
    });
  }
}