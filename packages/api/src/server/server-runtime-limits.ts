import { ApiResponseCache, PluginDatabaseQuota, SystemConstants, SystemSettingRegistry } from '@fromcode119/core';
import { RateLimitSettingsUtils } from '@api/utils/rate-limit-settings-utils';

/**
 * Hands the core's per-request budgets their operator settings, read from this process's settings
 * cache on every call so a save takes effect on the next request.
 */
export class ServerRuntimeLimits {
  static apply(settingsCache: Map<string, string>): void {
    PluginDatabaseQuota.useLimit(() => RateLimitSettingsUtils.resolvePluginDbCallsPerMinute(settingsCache));
    ApiResponseCache.useMaxAge(() => ServerRuntimeLimits.responseCacheSeconds(settingsCache));
  }

  /** Settings → Infrastructure → API response cache; the declared default until the operator saves one. */
  static responseCacheSeconds(settingsCache: Map<string, string>): number {
    const key = SystemConstants.META_KEY.API_RESPONSE_CACHE_SECONDS;
    const raw = settingsCache.get(key) ?? SystemSettingRegistry.defaultValueOf(key);
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  }
}
