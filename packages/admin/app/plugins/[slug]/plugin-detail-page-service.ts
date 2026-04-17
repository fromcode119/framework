import type { LoadedPlugin } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { PluginInstallOperationService } from '@/lib/plugin-install-operation-service';
import type {
  PluginDetailTab,
  PluginLogEntry,
  PluginMarketplaceItem,
  PluginSandboxSettings,
} from './plugin-detail-page.interfaces';

export class PluginDetailPageService {
  static readonly DEFAULT_SANDBOX_SETTINGS: PluginSandboxSettings = {
    enabled: true,
    memoryLimit: 128,
    timeout: 1000,
    allowNative: false,
  };

  static parseTab(value: string | null): PluginDetailTab {
    return value === 'settings' || value === 'permissions' || value === 'resources' ? value : 'overview';
  }

  static async fetchPlugin(slug: string): Promise<LoadedPlugin | null> {
    const data = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LIST);
    return data.find((plugin: LoadedPlugin) => plugin.manifest?.slug === slug) ?? null;
  }

  static async fetchMarketplaceItem(slug: string): Promise<PluginMarketplaceItem | null> {
    const data = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.MARKETPLACE);
    return data.plugins?.find((plugin: PluginMarketplaceItem) => plugin.slug === slug) ?? null;
  }

  static async fetchLogs(slug: string): Promise<PluginLogEntry[]> {
    return AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LOGS(slug));
  }

  static createSandboxSettings(plugin: LoadedPlugin): PluginSandboxSettings {
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

  static async togglePlugin(slug: string, enabled: boolean): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(slug), { enabled });
  }

  static async saveSandbox(slug: string, sandboxSettings: PluginSandboxSettings): Promise<PluginSandboxSettings | false> {
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
