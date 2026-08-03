import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { Logger } from '@core/logging';
import { DiscoveryService } from '@core/plugin/services/discovery-service';
import { PluginPublicSettingsService } from '@core/plugin/services/plugin-public-settings-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

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
