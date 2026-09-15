import { Logger } from '@core/logging';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Which catalogue THIS SITE browses.
 *
 * A site on this platform behaves like its own installation: it has a marketplace, and it may point
 * that marketplace at a catalogue of its own. So the answer is the site's setting when it has one and
 * the platform's otherwise — a site that has chosen nothing browses what the operator offers, which
 * is what every site did before this existed.
 *
 * THE READ CARRIES NO TENANT ID. `_system_meta` is tenant-scoped, so the request's own connection
 * binding decides whose row comes back; there is nothing to pass and therefore no way to read another
 * site's catalogue by accident. That is the same reason `TenantEmailPolicy` reads the way it does, and
 * it is why the accessor below is handed the REQUEST connection rather than the owner one.
 *
 * A FAILED READ IS NOT A CHOICE. If the site row cannot be read this answers with the platform's
 * catalogue rather than with nothing: a site whose marketplace silently emptied because a query broke
 * would look exactly like a site whose operator offers nothing, and nobody could tell those apart.
 */
export class SiteMarketplaceUrl {
  private static readonly logger = new Logger({ namespace: 'site-marketplace' });
  private static accessor: ((key: string) => Promise<string | null>) | null = null;

  /**
   * Wire the `_system_meta` reader once the DB is up, exactly as `PlatformSettingsService` is wired.
   *
   * Before this is called — a CLI, a test, a boot-time caller — there is no site setting to read and
   * every answer is the platform's, which is the behaviour that existed before per-site catalogues.
   */
  static registerAccessor(accessor: (key: string) => Promise<string | null>): void {
    SiteMarketplaceUrl.accessor = accessor;
  }

  /** Forgets nothing of its own — kept so tests can unwire the accessor between cases. */
  static reset(): void {
    SiteMarketplaceUrl.accessor = null;
  }

  /** The catalogue URL in force for the current request's site. */
  static async current(): Promise<string> {
    const own = await SiteMarketplaceUrl.siteValue();
    if (own) return own;
    return PlatformSettingsService.resolve(process.env.MARKETPLACE_URL, SystemConstants.META_KEY.MARKETPLACE_URL);
  }

  /**
   * The cache key for the resolved client: the site whose catalogue this is, or `''` for the
   * platform's.
   *
   * Exposed because the caller caching a built client MUST key it by this and not by nothing. One
   * client held for the life of the process would serve the first site's catalogue to every site
   * after it.
   */
  static currentScopeKey(): string {
    return String(RequestContextUtils.getTenantId() ?? '').trim();
  }

  private static async siteValue(): Promise<string> {
    if (!SiteMarketplaceUrl.accessor) return '';
    // No tenant bound means no site to ask — a boot-time or background read, which is the platform's.
    if (!SiteMarketplaceUrl.currentScopeKey()) return '';
    try {
      const value = await SiteMarketplaceUrl.accessor(SystemConstants.META_KEY.SITE_MARKETPLACE_URL);
      return String(value ?? '').trim();
    } catch (error: unknown) {
      SiteMarketplaceUrl.logger.warn(
        `Could not read "${SystemConstants.META_KEY.SITE_MARKETPLACE_URL}"; falling back to the platform's catalogue. `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      return '';
    }
  }
}
