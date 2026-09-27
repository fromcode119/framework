import { CoercionUtils } from '@core/utils/coercion-utils';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * How much a SITE may store in themes it uploaded itself.
 *
 * The limit exists because the themes volume is ONE host directory shared by every tenant on the
 * machine. An unbounded upload is therefore a denial of service against every other customer rather
 * than against the uploader, which is why the ceiling is a PLATFORM setting: a site choosing its own
 * would be no ceiling at all.
 *
 * The defaults are DECLARED in `SystemConstants` and named by the Infrastructure page's "Site
 * uploads" card as its placeholders, so an operator sees what an empty field resolves to and can
 * change it. They live in one place so the screen and this check cannot drift apart.
 */
export class TenantThemeQuota {

  static readonly DEFAULT_MAX_BYTES = SystemConstants.TENANT_THEME_MAX_MB_DEFAULT * 1024 * 1024;

  static readonly DEFAULT_MAX_COUNT = SystemConstants.TENANT_THEME_MAX_COUNT_DEFAULT;

  /**
   * The limits in force right now.
   *
   * A value that is absent, unparseable or not positive falls back to the declared default rather
   * than to "no limit": a typo in a settings field must not quietly remove the protection, and zero
   * would mean a site could store nothing at all, which no operator types on purpose.
   */
  static async current(): Promise<{ maxBytes: number; maxThemes: number }> {
    const [bytes, count] = await Promise.all([
      PlatformSettingsService.resolve(undefined, SystemConstants.META_KEY.TENANT_THEME_MAX_BYTES),
      PlatformSettingsService.resolve(undefined, SystemConstants.META_KEY.TENANT_THEME_MAX_COUNT),
    ]);

    return {
      maxBytes: TenantThemeQuota.positiveOr(bytes, TenantThemeQuota.DEFAULT_MAX_BYTES),
      maxThemes: TenantThemeQuota.positiveOr(count, TenantThemeQuota.DEFAULT_MAX_COUNT),
    };
  }

  private static positiveOr(raw: unknown, fallback: number): number {
    const value = CoercionUtils.toNumber(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
