import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { Logger } from '@core/logging';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { PluginPublicSettingsService } from '@core/plugin/services/settings/plugin-public-settings-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { AppearanceManager } from '@core/appearance/appearance-manager';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';

/**
 * PluginManagerQueryService
 *
 * Read-side helpers for PluginManager: topological plugin sort and public
 * (security-filtered) frontend plugin settings. Extracted to keep PluginManager
 * under the size limit; the manager keeps its public entry points and delegates.
 */
export class PluginManagerQueryService {
  constructor(
    private logger: Logger,
    private db: any,
    private discovery: DiscoveryService,
    private plugins: Map<string, ILoadedPlugin>,
  ) {}

  /**
   * Whether an extension of this scope is already installed.
   *
   * Answered from what is ON DISK rather than from a build record: the record says what was built,
   * and the question being asked is what is running. It decides whether a build may install itself
   * (additive) or must wait for the separate consent that allows REPLACING a running extension.
   */
  async isExtensionInstalled(slug: string, type: ExtensionScope, themeManager?: any): Promise<boolean> {
    const name = String(slug || '').trim();
    if (!name) return false;

    const scope = ExtensionScope.find(type);
    if (scope === ExtensionScope.THEME) {
      return Boolean(themeManager?.getThemes?.().some((theme: any) => theme?.slug === name));
    }
    if (scope === ExtensionScope.APPEARANCE) {
      return new AppearanceManager(this.logger).list().some((item) => item.slug === name && !item.builtIn);
    }
    if (scope === ExtensionScope.CORE) {
      // Core is always present — it is what is running. "Already installed" is never the question
      // being asked about it, and answering false would invite a caller to install it as if new.
      return true;
    }
    return Array.from(this.plugins.values()).some((plugin) => plugin?.manifest?.slug === name);
  }

  /** Returns plugins in topological order based on their dependencies. */
  getSortedPlugins(pluginsToSort?: ILoadedPlugin[]): ILoadedPlugin[] {
    const list = pluginsToSort || Array.from(this.plugins.values());
    try {
      return this.discovery.resolveDependencies(list as any) as ILoadedPlugin[];
    } catch (err: any) {
      this.logger.warn(`Topological sort failed: ${err.message}. Returning unsorted list.`);
      return list;
    }
  }

  /**
   * Resolved, security-filtered public settings for every active plugin, keyed by
   * `namespace/slug` (and bare `slug`). Only fields flagged `public: true` in a plugin's
   * settings schema are included; password/credential fields are always excluded.
   * Safe to embed in the public, unauthenticated frontend metadata response.
   */
  async getPublicFrontendPluginSettings(
    getPluginSettings: (slug: string) => any | undefined,
  ): Promise<Record<string, Record<string, any>>> {
    const activePlugins = Array.from(this.plugins.values()).filter((plugin) => plugin.state === PluginState.ACTIVE);
    return PluginPublicSettingsService.resolve(activePlugins, getPluginSettings, this.db);
  }
}
