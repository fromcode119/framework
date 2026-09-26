import { SystemConstants } from '@core/constants/system.constants';
import { Logger } from '@core/logging';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginConfigValueService } from '@core/plugin/services/settings/plugin-config-value-service';
import { PluginSettingsKeyMigrationService } from '@core/plugin/services/settings/plugin-settings-key-migration-service';

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
    // The in-memory manifest is ONE object per plugin for the whole process — the PLATFORM's copy. A
    // site's save must not land there: it did, and every other site's settings screen then showed that
    // site's values (issuer, IBAN, tax rate), and saving it wrote them into the other site's row.
    if (RequestContextUtils.getTenantId()) return;
    const plugin = this.plugins.get(slug);
    if (plugin) {
      plugin.manifest.config = config;
    }
  }

  /**
   * The current scope's stored config, with its settings reconciled onto the names the plugin
   * declares today — exactly what `context.settings.get()` reads at runtime (before schema defaults).
   */
  async loadPluginConfig(slug: string): Promise<Record<string, any>> {
    const config = await this.registry.loadPluginConfig(slug);
    const settings = PluginSettingsKeyMigrationService.reconcile(
      PluginConfigValueService.getSettings(config),
      this.pluginSettings.get(slug),
    ).settings;
    return { ...config, settings };
  }

  async saveSandboxConfig(slug: string, config: any): Promise<void> {
    // The table is `Schema.systemPlugins`. A bare `systemPlugins` is no longer exported, and reading it
    // handed `update` an undefined table — every save of a plugin's limits answered 500 and saved nothing.
    const { Schema } = require('@fromcode119/database');
    const isExplicitlyDisabled = config === false || (config && typeof config === 'object' && config.enabled === false);
    const normalizedConfig = isExplicitlyDisabled
      ? false
      : (config && typeof config === 'object'
          ? Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'enabled'))
          : {});

    await this.db.update(Schema.systemPlugins, { slug }, {
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