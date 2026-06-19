import { AdminConstants } from '@/lib/constants';

const METADATA_RETRY_COOLDOWN_MS = 15000;

/**
 * Coordinates the one-shot admin metadata bootstrap fetch, sharing a single in-flight
 * promise across callers and applying a cooldown after failures so the loader does not
 * hammer the endpoint on every retry.
 */
export class PluginMetadataBootstrapService {
  private static bootstrapPromise: Promise<void> | null = null;
  private static bootstrapError: unknown = null;
  private static bootstrapRetryAfter = 0;

  static async ensureLoaded(loadConfig: (path?: string) => Promise<any>): Promise<void> {
    const now = Date.now();

    if (PluginMetadataBootstrapService.bootstrapPromise) {
      return PluginMetadataBootstrapService.bootstrapPromise;
    }

    if (PluginMetadataBootstrapService.bootstrapError && PluginMetadataBootstrapService.bootstrapRetryAfter > now) {
      throw PluginMetadataBootstrapService.bootstrapError;
    }

    PluginMetadataBootstrapService.bootstrapPromise = loadConfig(AdminConstants.ENDPOINTS.SYSTEM.METADATA)
      .then(() => {
        PluginMetadataBootstrapService.bootstrapError = null;
        PluginMetadataBootstrapService.bootstrapRetryAfter = 0;
      })
      .catch((error) => {
        PluginMetadataBootstrapService.bootstrapError = error;
        PluginMetadataBootstrapService.bootstrapRetryAfter = Date.now() + METADATA_RETRY_COOLDOWN_MS;
        throw error;
      })
      .finally(() => {
        PluginMetadataBootstrapService.bootstrapPromise = null;
      });

    return PluginMetadataBootstrapService.bootstrapPromise;
  }
}
