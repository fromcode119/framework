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
 * THE DEFAULTS BELOW ARE THE ADMIN FIELD'S DECLARED DEFAULTS, mirrored here rather than invented.
 * The setting is exposed in admin Settings and states the same numbers, so an operator can see what
 * an empty field resolves to and change it. A second, hidden default that no screen names is exactly
 * the magic this codebase forbids — so if these numbers are ever changed, the field's declaration
 * changes with them.
 */
export class TenantThemeQuota {

  /** 25 MB. A browser-rendered theme is markup, styles, scripts and images; this is generous for that. */
  static readonly DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

  /** Enough to keep a previous version and try a new one, without a site accumulating without limit. */
  static readonly DEFAULT_MAX_COUNT = 5;

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
