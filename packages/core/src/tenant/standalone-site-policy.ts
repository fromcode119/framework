import { SystemConstants } from '@core/constants/system.constants';
import { TenantEnvironment } from '@core/enums/tenant-environment.enum';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * The environment and indexability of a SINGLE-SITE deployment.
 *
 * A deployment with sites keeps both on each site's `_system_tenants` row (`environment`,
 * `visibility`). A single-site deployment has no row, so the same two answers live in two platform
 * settings (Settings → General → Site) and are read here. Everything that brakes or de-indexes a site
 * asks this class when there is no tenant, so the two kinds of deployment behave the same.
 *
 * ONCE A DEPLOYMENT HAS SITES, THIS ANSWERS "production, indexable" ALWAYS. Requests with no tenant
 * there are the platform's own work — certificate mail, the console, telemetry — and a leftover
 * single-site setting must never mute the platform's mail or de-index anything.
 *
 * Read per call, not cached: flipping the switch in the admin has to stop the next email, not the one
 * after a cache expires. It is one `_system_meta` row, and only outward-facing effects ask.
 */
export class StandaloneSitePolicy {
  /** Whether the single site may reach the outside world. An unset or unknown value is production, as for a site row. */
  static async isProduction(): Promise<boolean> {
    if (TenantMode.isEnabled()) return true;
    const value = await PlatformSettingsService.getSetting(SystemConstants.META_KEY.SITE_ENVIRONMENT);
    return (TenantEnvironment.find(value) ?? TenantEnvironment.PRODUCTION).isProduction;
  }

  /**
   * Whether search engines may index the single site.
   *
   * Unset reads as INDEXABLE, unlike the platform-host switch: the setting is seeded `true` at boot,
   * and a single-site storefront was always indexable before it existed — an upgrade must not take a
   * live shop out of search. Only an explicit `false` refuses.
   */
  static async isIndexable(): Promise<boolean> {
    if (TenantMode.isEnabled()) return true;
    const value = await PlatformSettingsService.getSetting(SystemConstants.META_KEY.SITE_SEARCH_INDEXING);
    return value === null || value === 'true';
  }
}
