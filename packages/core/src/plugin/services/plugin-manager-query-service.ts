import { LoadedPlugin } from '../../types';
import { Logger } from '../../logging';
import { DiscoveryService } from './discovery-service';
import { PluginPublicSettingsService } from './plugin-public-settings-service';

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
    private plugins: Map<string, LoadedPlugin>,
  ) {}

  /** Returns plugins in topological order based on their dependencies. */
  getSortedPlugins(pluginsToSort?: LoadedPlugin[]): LoadedPlugin[] {
    const list = pluginsToSort || Array.from(this.plugins.values());
    try {
      return this.discovery.resolveDependencies(list as any) as LoadedPlugin[];
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
    const activePlugins = Array.from(this.plugins.values()).filter((plugin) => plugin.state === 'active');
    return PluginPublicSettingsService.resolve(activePlugins, getPluginSettings, this.db);
  }
}
