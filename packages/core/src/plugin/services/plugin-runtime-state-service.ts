import { SystemConstants } from '../../constants';
import { Logger } from '../../logging';
import { PluginStateService } from './plugin-state-service';
import type { Collection, LoadedPlugin } from '../../types';

export class PluginRuntimeStateService {
  constructor(
    private readonly logger: Logger,
    private readonly db: any,
    private readonly registry: PluginStateService,
    private readonly plugins: Map<string, LoadedPlugin>,
    private readonly headInjections: Map<string, any[]>,
    private readonly registeredCollections: Map<string, { collection: Collection; pluginSlug: string }>,
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

  getCollections(): Collection[] {
    return Array.from(this.registeredCollections.values()).map((entry) => entry.collection);
  }

  getCollection(slug: string): { collection: Collection; pluginSlug: string } | undefined {
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

    plugin.state = 'error';
    await this.db.update(SystemConstants.TABLE.PLUGINS, { slug }, {
      state: 'error',
      health_status: 'error',
      updated_at: new Date(),
    });
  }
}