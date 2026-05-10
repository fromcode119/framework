import type { LoadedPlugin } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { VersionComparisonService } from '@/lib/version-comparison-service';

export class PluginVersionWaitService {
  private static readonly POLL_INTERVAL_MS = 1000;
  private static readonly DEFAULT_TIMEOUT_MS = 90 * 1000;

  static async fetchInstalledPlugin(slug: string): Promise<LoadedPlugin | null> {
    const data = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.LIST);
    return data.find((plugin: LoadedPlugin) => plugin.manifest?.slug === slug) ?? null;
  }

  static async waitForInstalledVersion(slug: string, targetVersion: string, timeoutMs = this.DEFAULT_TIMEOUT_MS): Promise<LoadedPlugin> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const plugin = await this.fetchInstalledPlugin(slug);
        if (plugin && !VersionComparisonService.isGreater(targetVersion, plugin.manifest.version)) {
          return plugin;
        }
      } catch (error) {
        if (!this.isTransientRestartError(error)) {
          throw error;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, this.POLL_INTERVAL_MS));
    }

    throw new Error(`The plugin restart completed, but the installed version is still below ${targetVersion}. The marketplace ZIP or runtime restart is still stale.`);
  }

  private static isTransientRestartError(error: unknown): boolean {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

    if ([502, 503, 504].includes(status)) {
      return true;
    }

    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes('Failed to fetch')
      || message.includes('Network request failed')
      || message.includes('Bad gateway')
      || message.includes('502: Bad gateway');
  }
}
