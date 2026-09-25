import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';

/**
 * Each SITE's configured default locale (admin Settings → Localization, `default_locale`), readable
 * synchronously.
 *
 * `context.i18n.defaultLocale()` is synchronous and is what plugins use for documents and messages a
 * site issues — invoices, agreements, emails. It answered with the PLATFORM's locale, so a Bulgarian
 * site on an English platform issued English invoices. The site's value is loaded once when a request's
 * site is bound (`warm`, from the tenancy middleware), carried on the request context — into isolated
 * plugins too — and dropped when a site saves its settings (`invalidate`).
 *
 * A site with no `default_locale` of its own reads as '' and callers fall back to the platform's.
 */
export class SiteLocaleAccess {
  private static readonly logger = new Logger({ namespace: 'site-locale' });

  /** tenantId -> the site's default locale ('' = none of its own). A missing key = never loaded. */
  private static cache = new Map<string, string>();

  /** Reads one site's own `default_locale` row. Wired once at boot by the api. */
  private static reader: ((tenantId: string) => Promise<string>) | undefined;

  private static unregister: (() => void) | undefined;

  static configure(reader: (tenantId: string) => Promise<string>): void {
    SiteLocaleAccess.reader = reader;
    SiteLocaleAccess.cache = new Map();
    // A saved locale takes effect on the next request: a site's save drops that site's value, a
    // platform save drops every site's.
    SiteLocaleAccess.unregister?.();
    SiteLocaleAccess.unregister = SettingChangeInvalidators.register(
      [SystemConstants.META_KEY.DEFAULT_LOCALE],
      (tenantId) => SiteLocaleAccess.invalidate(tenantId ?? undefined),
    );
  }

  /** Loads a site's locale if it is not in memory. A failed read is not cached. */
  static async warm(tenantId: string): Promise<void> {
    const tenant = String(tenantId ?? '').trim();
    if (!tenant || !SiteLocaleAccess.reader || SiteLocaleAccess.cache.has(tenant)) return;
    try {
      SiteLocaleAccess.cache.set(tenant, String(await SiteLocaleAccess.reader(tenant) ?? '').trim().toLowerCase());
    } catch (error: unknown) {
      SiteLocaleAccess.logger.warn(
        `Could not read the default locale of site "${tenant}": ${error instanceof Error ? error.message : String(error)}. `
        + 'It falls back to the platform locale until a read succeeds.',
      );
    }
  }

  /** The site's default locale, or '' when it has none of its own (or was never loaded). */
  static get(tenantId: string | undefined | null): string {
    const tenant = String(tenantId ?? '').trim();
    return tenant ? SiteLocaleAccess.cache.get(tenant) ?? '' : '';
  }

  /** Forget one site's locale, or every site's (a platform-level save). */
  static invalidate(tenantId?: string): void {
    const tenant = String(tenantId ?? '').trim();
    if (tenant) SiteLocaleAccess.cache.delete(tenant);
    else SiteLocaleAccess.cache.clear();
  }
}
