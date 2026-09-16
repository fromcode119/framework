import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { Logger } from '@core/logging';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { PluginPublicSettingsService } from '@core/plugin/services/settings/plugin-public-settings-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { AppearanceManager } from '@core/appearance/appearance-manager';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import { SystemConstants } from '@core/constants/system.constants';

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

  /**
   * WHICH version of an extension is INSTALLED, or null when none is.
   *
   * For a plugin this is the `_system_plugins` row, not the manifest held in memory. The in-memory
   * copy is what this PROCESS loaded at boot, so after an install it still reports the previous
   * version until a restart — the Sources screen then said "installed 0.1.29" while the row, the files
   * and the admin's own Installed page all said 0.1.30, and the panel refused to offer a rollback
   * because it believed the old version was still in place. The row is what every other screen reads,
   * and agreeing with them is worth more here than reporting this process's private view.
   *
   * Themes and appearances are read from their managers, which re-read their directories rather than
   * caching a boot-time snapshot, so those already answer with what is in place.
   *
   * CORE answers null. It is what is running rather than something installed beside it, and no
   * caller may offer to swap its version from this surface.
   */
  async installedExtensionVersion(slug: string, type: ExtensionScope, themeManager?: any): Promise<string | null> {
    const name = String(slug || '').trim();
    if (!name) return null;

    const scope = ExtensionScope.find(type);
    const version = (value: unknown): string | null => {
      const text = String(value ?? '').trim();
      return text || null;
    };

    if (scope === ExtensionScope.THEME) {
      return version(themeManager?.getThemes?.().find((theme: any) => theme?.slug === name)?.version);
    }
    if (scope === ExtensionScope.APPEARANCE) {
      return version(new AppearanceManager(this.logger).list()
        .find((item) => item.slug === name && !item.builtIn)?.version);
    }
    if (scope === ExtensionScope.CORE) return null;

    const row = await this.db?.findOne?.(SystemConstants.TABLE.PLUGINS, { slug: name })
      .catch(() => null);
    const recorded = version(row?.version);
    if (recorded) return recorded;

    // No row is not the same as no plugin: a plugin discovered from disk that has never been recorded
    // still answers with what it loaded, rather than reading as "not installed" and offering a fresh
    // install of something already running.
    return version(Array.from(this.plugins.values())
      .find((plugin) => plugin?.manifest?.slug === name)?.manifest?.version);
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
