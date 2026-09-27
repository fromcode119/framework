import { CoercionUtils } from '@core/utils/coercion-utils';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Whether a SITE may upload its own plugins, and how much it may store in them.
 *
 * All three are PLATFORM settings, shown on Infrastructure → Site Uploads. Uploads are OFF until the
 * platform turns them on: a site's plugin is code running on the box every customer shares, so it
 * is opted into knowingly, never by default. The size and count defaults are declared once in
 * `SystemConstants` and named on that screen as the fields' placeholders.
 */
export class TenantPluginQuota {
  static readonly DEFAULT_MAX_BYTES = SystemConstants.TENANT_PLUGIN_MAX_MB_DEFAULT * 1024 * 1024;
  static readonly DEFAULT_MAX_COUNT = SystemConstants.TENANT_PLUGIN_MAX_COUNT_DEFAULT;

  static async current(): Promise<{ enabled: boolean; maxBytes: number; maxPlugins: number }> {
    const [enabled, bytes, count] = await Promise.all([
      PlatformSettingsService.resolve(undefined, SystemConstants.META_KEY.TENANT_PLUGIN_UPLOADS_ENABLED),
      PlatformSettingsService.resolve(undefined, SystemConstants.META_KEY.TENANT_PLUGIN_MAX_BYTES),
      PlatformSettingsService.resolve(undefined, SystemConstants.META_KEY.TENANT_PLUGIN_MAX_COUNT),
    ]);
    return {
      enabled: CoercionUtils.toBoolean(enabled) === true,
      maxBytes: TenantPluginQuota.positiveOr(bytes, TenantPluginQuota.DEFAULT_MAX_BYTES),
      maxPlugins: TenantPluginQuota.positiveOr(count, TenantPluginQuota.DEFAULT_MAX_COUNT),
    };
  }

  private static positiveOr(raw: unknown, fallback: number): number {
    const value = CoercionUtils.toNumber(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
