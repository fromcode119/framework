import { SiteContentRevision } from '@core/tenant/site-content-revision';
import { SystemConstants } from '@core/constants/system.constants';
import { Logger } from '@core/logging';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { RequestContextUtils } from '@core/context/request-context';
import { PluginConfigValueService } from '@core/plugin/services/settings/plugin-config-value-service';
import { PluginSettingsKeyMigrationService } from '@core/plugin/services/settings/plugin-settings-key-migration-service';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { ApiWorkers } from '@core/cluster/api-workers';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';

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
    // A plugin's settings (a tax rate, a currency, a label) can change what that site's pages and
    // cached answers show: the site's content revision moves, or every site's for a platform save.
    SiteContentRevision.bumpCurrentSite();
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
    // Only a plugin's LIMITS are saved. Where it runs is not a setting (every plugin is isolated, see
    // `PluginIsolationSettings`), so an `enabled: false` or `sandbox: false` — and `allowNative`, which
    // nothing ever read — would be a stored value no runtime obeys.
    const source = config && typeof config === 'object' ? config as Record<string, unknown> : {};
    const normalizedConfig: Record<string, number> = {};
    for (const key of ['memoryLimit', 'timeout'] as const) {
      const value = CoercionUtils.toNumber(source[key]);
      if (value > 0) normalizedConfig[key] = value;
    }

    await this.db.update(Schema.systemPlugins, { slug }, {
      sandboxConfig: normalizedConfig,
    });

    const plugin = this.plugins.get(slug);
    if (plugin) {
      const current = plugin.manifest.sandbox && typeof plugin.manifest.sandbox === 'object' ? plugin.manifest.sandbox : {};
      const { memoryLimit: _memory, timeout: _timeout, ...rest } = current as Record<string, unknown>;
      plugin.manifest.sandbox = { ...rest, ...normalizedConfig } as typeof plugin.manifest.sandbox;
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

  async disableWithError(slug: string, message: string): Promise<void> {
    if (!this.markStopped(slug, message)) return;
    // In-memory state goes 'error' (runtime excludes it); the DB only flips health to
    // 'error' and KEEPS the desired `state` column so the plugin recovers to its prior
    // active/inactive state on the next clean boot instead of being stuck in error.
    await this.db.update(SystemConstants.TABLE.PLUGINS, { slug }, {
      health_status: 'error',
      updated_at: new Date(),
    });
    // With several api processes, api 0 decides whether a plugin's process runs (it starts them): the
    // others mirror its stop instead of each holding a process the platform has given up on.
    if (ApiWorkers.isMultiProcess() && ApiWorkers.startsPluginProcesses()) {
      ProcessSignals.announce(ProcessSignal.PLUGIN_STOPPED, { slug, message });
    }
  }

  /**
   * The platform stopped this plugin, in this process's memory only — what `disableWithError` records
   * here, and what another api process's stop is mirrored with. False when there is no such plugin.
   */
  markStopped(slug: string, message: string): boolean {
    const plugin = this.plugins.get(slug);
    if (!plugin) return false;
    // The reason is what the admin shows beside the switch (`plugin.error`); dropping it left a plugin
    // switched off with nothing saying why.
    plugin.error = message;
    plugin.healthStatus = PluginRegistryHealth.ERROR;
    plugin.stoppedByPlatform = true;
    plugin.state = PluginState.ERROR;
    return true;
  }
}