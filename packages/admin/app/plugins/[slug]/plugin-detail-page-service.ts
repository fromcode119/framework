import type { ILoadedPlugin } from '@fromcode119/core/client';
import type { IAdminPluginMetadata } from '@/app/interfaces/admin-plugin-metadata.interface';
import { LoadedPluginHydration, SystemConstants } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import { PluginVersionWaitService } from '@/lib/plugin-version-wait-service';
import { PluginDetailTab } from '@/app/plugins/[slug]/enums/plugin-detail-tab.enum';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import type { IPluginMarketplaceItem } from '@/app/plugins/[slug]/interfaces/plugin-marketplace-item.interface';
import type { IPluginSandboxSettings } from '@/app/plugins/[slug]/interfaces/plugin-sandbox-settings.interface';
import type { IPluginRuntimeResponse } from '@/app/plugins/[slug]/interfaces/plugin-runtime-response.interface';

export class PluginDetailPageService {
  /**
   * No memory/timeout number here: an operator who never set a limit sees an EMPTY field with the
   * platform's own default (Settings → Infrastructure → Plugin Isolation) as its placeholder, never
   * a number nobody configured for this plugin.
   */
  static readonly DEFAULT_SANDBOX_SETTINGS: IPluginSandboxSettings = {
    enabled: true,
    memoryLimit: null,
    timeout: null,
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

  static async fetchRuntime(slug: string): Promise<IPluginRuntimeResponse> {
    return AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.RUNTIME(slug));
  }

  /**
   * Read from `plugin.manifest.sandbox` — the field the API actually serializes; `plugin.sandbox`
   * (top-level) is never populated by anything, so reading it always fell through to the invented
   * 128/1000 defaults below and the operator's real saved limits never reached this screen.
   */
  static createSandboxSettings(plugin: ILoadedPlugin): IPluginSandboxSettings {
    const sandbox = plugin.manifest?.sandbox;
    if (sandbox === false) {
      return {
        ...PluginDetailPageService.DEFAULT_SANDBOX_SETTINGS,
        enabled: false,
      };
    }

    if (sandbox && typeof sandbox === 'object') {
      return {
        enabled: true,
        memoryLimit: typeof sandbox.memoryLimit === 'number' ? sandbox.memoryLimit : null,
        timeout: typeof sandbox.timeout === 'number' ? sandbox.timeout : null,
        allowNative: sandbox.allowNative || false,
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

  /**
   * Saves the sandbox row and reports what happened to the RUNNING plugin, which is not always the
   * same thing: the write can succeed while the change still needs an API restart to take effect
   * (flipping isolation on or off), or — for a live reload of an already-isolated plugin — the save
   * can succeed while the reload itself failed and the guest may now be down. Neither of those is a
   * failed save, so both are reported through the result, not thrown.
   */
  static async saveSandbox(slug: string, sandboxSettings: IPluginSandboxSettings): Promise<{ restartRequired: boolean; restartFailed?: boolean; reason?: string }> {
    const payload = sandboxSettings.enabled
      ? {
          memoryLimit: sandboxSettings.memoryLimit,
          timeout: sandboxSettings.timeout,
          allowNative: sandboxSettings.allowNative,
        }
      : { enabled: false };

    const response = await AdminApi.post(`${AdminConstants.ENDPOINTS.PLUGINS.BASE}/${slug}/sandbox`, payload);
    return {
      restartRequired: Boolean(response?.restartRequired),
      restartFailed: Boolean(response?.restartFailed),
      reason: response?.reason ? String(response.reason) : undefined,
    };
  }

  /**
   * The EFFECTIVE plugin isolation memory/timeout in force right now — `_system_meta` when the
   * operator set one (Settings → Infrastructure → Plugin Isolation), the shipped constant otherwise.
   * Mirrors `PluginIsolationSettings.read` on the server: never the constant alone, or a plugin
   * running on a platform-configured 512MB would still be told its blank field means 256.
   */
  static async fetchIsolationDefaults(): Promise<{ memoryMb: number; timeoutMs: number } | null> {
    const response = await AdminSystemSettingsClient.getAll();
    const memoryRaw = Number(response?.plugin_isolation_memory_mb);
    const timeoutRaw = Number(response?.plugin_isolation_timeout_ms);
    return {
      memoryMb: memoryRaw > 0 ? memoryRaw : SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT,
      timeoutMs: timeoutRaw > 0 ? timeoutRaw : SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT,
    };
  }

  static async deletePlugin(slug: string): Promise<void> {
    await AdminApi.delete(AdminConstants.ENDPOINTS.PLUGINS.DELETE(slug));
  }
}
