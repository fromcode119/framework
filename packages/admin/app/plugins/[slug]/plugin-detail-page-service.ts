import type { ILoadedPlugin } from '@fromcode119/core/client';
import type { IAdminPluginMetadata } from '@/app/interfaces/admin-plugin-metadata.interface';
import { LoadedPluginHydration } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { PluginVersionWaitService } from '@/lib/plugin-version-wait-service';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';

export class PluginDetailPageService {
  static readonly DEFAULT_SANDBOX_SETTINGS: IPluginSandboxSettings = {
    enabled: true,
    memoryLimit: 128,
    timeout: 1000,
    allowNative: false,
  };

  /**
   * This plugin's UI assets, shaped the way the asset loader expects.
   *
   * Returns null when the plugin ships no admin bundle, so the caller loads nothing rather than
   * requesting a URL that does not exist.
   *
   * The version query is the plugin's VERSION, not the bundle's mtime: the mtime is a filesystem
   * fact the server has and the browser does not. That is enough for a released plugin, whose
   * version changes with its contents; a local rebuild WITHOUT a version bump keeps the same URL,
   * so a hard reload is still the way to see that change here.
   */
  static uiEntryMetadata(plugin: ILoadedPlugin | null): IAdminPluginMetadata | null {
    const slug = String(plugin?.manifest?.slug ?? '').trim();
    const entry = String((plugin?.manifest as any)?.ui?.entry ?? '').trim();
    if (!slug || !entry) return null;

    const version = String(plugin?.manifest?.version ?? '').trim();
    const suffix = version ? `?v=${encodeURIComponent(version)}` : '';
    const asset = (name: string): string => `/plugins/${slug}/ui/${String(name).replace(/^\/+/, '')}${suffix}`;
    const css = [
      ...(((plugin?.manifest as any)?.ui?.css) || []),
      ...(((plugin?.manifest as any)?.ui?.adminCss) || []),
    ].map((name: string) => asset(name));

    return {
      slug,
      name: String(plugin?.manifest?.name ?? slug),
      ui: { entryUrl: asset(entry), cssUrls: css },
    };
  }

  static parseTab(value: string | null): PluginDetailTab {
    return PluginDetailTab.resolve(value);
  }

  static async fetchPlugin(slug: string): Promise<ILoadedPlugin | null> {
    return LoadedPluginHydration.one(await PluginVersionWaitService.fetchInstalledPlugin(slug));
  }

  static async fetchMarketplaceItem(slug: string): Promise<IPluginMarketplaceItem | null> {
    const data = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE);
    return data.plugins?.find((plugin: IPluginMarketplaceItem) => plugin.slug === slug) ?? null;
  }

  static async fetchLogs(slug: string): Promise<IPluginLogEntry[]> {
    return AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LOGS(slug));
  }

  static createSandboxSettings(plugin: ILoadedPlugin): IPluginSandboxSettings {
    if (plugin.sandbox === false) {
      return {
        ...PluginDetailPageService.DEFAULT_SANDBOX_SETTINGS,
        enabled: false,
      };
    }

    if (plugin.sandbox && typeof plugin.sandbox === 'object') {
      return {
        enabled: true,
        memoryLimit: plugin.sandbox.memoryLimit || 128,
        timeout: plugin.sandbox.timeout || 1000,
        allowNative: plugin.sandbox.allowNative || false,
      };
    }

    return { ...PluginDetailPageService.DEFAULT_SANDBOX_SETTINGS };
  }

  static async updatePlugin(slug: string): Promise<{ operationId: string; dependencies: string[] }> {
    return PluginInstallOperationService.startMarketplaceInstall(slug);
  }

  static async waitForInstalledVersion(slug: string, targetVersion: string, timeoutMs = 15000): Promise<ILoadedPlugin> {
    return PluginVersionWaitService.waitForInstalledVersion(slug, targetVersion, timeoutMs);
  }

  static async togglePlugin(slug: string, enabled: boolean): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(slug), { enabled });
  }

  static async saveSandbox(slug: string, sandboxSettings: IPluginSandboxSettings): Promise<IPluginSandboxSettings | false> {
    const payload = sandboxSettings.enabled
      ? {
          memoryLimit: sandboxSettings.memoryLimit,
          timeout: sandboxSettings.timeout,
          allowNative: sandboxSettings.allowNative,
        }
      : { enabled: false };

    await AdminApi.post(`${AdminConstants.ENDPOINTS.PLUGINS.BASE}/${slug}/sandbox`, payload);
    return sandboxSettings.enabled ? sandboxSettings : false;
  }

  static async deletePlugin(slug: string): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.PLUGINS.DELETE(slug));
  }
}
