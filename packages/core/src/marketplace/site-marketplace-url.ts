import { Logger } from '@core/logging';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Which catalogue THIS SITE browses.
 *
 * A site on this platform behaves like its own installation: it has a marketplace, and it may point
 * that marketplace at a catalogue of its own. So the answer is the site's setting when it has one,
 * and the platform's otherwise — a site that has chosen nothing browses what the operator offers,
 * which is what every site did before this existed.
 *
 * THE SITE READ CARRIES NO TENANT ID. `_system_meta` is tenant-scoped, so the connection's own
 * binding decides whose row comes back; there is nothing to pass and therefore no way to read another
 * site's catalogue by accident. That is the same reason `TenantEmailPolicy` reads the way it does.
 *
 * A FAILED READ IS NOT A CHOICE. If the site row cannot be read, this answers with the platform's
 * catalogue rather than with nothing: a site whose marketplace silently emptied because a query broke
 * would look exactly like a site whose operator offers nothing, and an operator would have no way to
 * tell those apart.
 */
export class SiteMarketplaceUrl {
  private static readonly logger = new Logger({ namespace: 'site-marketplace' });

  /**
   * The catalogue URL in force for the current request's site.
   *
   * `db` is the request's own connection. Pass none — a boot-time or background caller, where there
   * is no site to ask — and this is simply the platform's answer.
   */
  static async current(db?: { findOne(table: string, where: Record<string, unknown>): Promise<unknown> }): Promise<string> {
    const own = await SiteMarketplaceUrl.siteValue(db);
    if (own) return own;
    return PlatformSettingsService.resolve(process.env.MARKETPLACE_URL, SystemConstants.META_KEY.MARKETPLACE_URL);
  }

  /** Has this site chosen a catalogue of its own? Used by the admin to say which one it is showing. */
  static async isSiteChosen(db?: { findOne(table: string, where: Record<string, unknown>): Promise<unknown> }): Promise<boolean> {
    return Boolean(await SiteMarketplaceUrl.siteValue(db));
  }

  private static async siteValue(db?: { findOne(table: string, where: Record<string, unknown>): Promise<unknown> }): Promise<string> {
    if (!db) return '';
    try {
      const row = await db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.SITE_MARKETPLACE_URL });
      return String((row as { value?: unknown } | null)?.value ?? '').trim();
    } catch (error: unknown) {
      SiteMarketplaceUrl.logger.warn(
        `Could not read "${SystemConstants.META_KEY.SITE_MARKETPLACE_URL}"; falling back to the platform's catalogue. `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
      return '';
    }
  }
}
