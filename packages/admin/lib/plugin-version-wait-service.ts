import type { LoadedPlugin } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { VersionComparisonService } from '@/lib/version-comparison-service';

export class PluginVersionWaitService {
  static async fetchInstalledPlugin(slug: string): Promise<LoadedPlugin | null> {
    const data = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LIST);
    return data.find((plugin: LoadedPlugin) => plugin.manifest?.slug === slug) ?? null;
  }

  static async waitForInstalledVersion(slug: string, targetVersion: string, timeoutMs = 15000): Promise<LoadedPlugin> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const plugin = await this.fetchInstalledPlugin(slug);
      if (plugin && !VersionComparisonService.isGreater(targetVersion, plugin.manifest.version)) {
        return plugin;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`The plugin restart completed, but the installed version is still below ${targetVersion}. The marketplace ZIP or runtime restart is still stale.`);
  }
}
