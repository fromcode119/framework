import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';

/**
 * The `hreflang` alternates of one page: the same path in every locale the site enables (admin
 * Settings → Localization), addressed the way the site's `locale_url_strategy` encodes a locale.
 *
 * The default locale keeps the bare path and is also `x-default`; any other locale gets its prefix
 * (`/en/services`) or its `?locale=` query. A site with one locale, or with the `none` strategy, has a
 * single address per page and therefore no alternates. The addresses are absolute and take the
 * origin of the page's canonical URL, so a page without a canonical gets none.
 */
export class LocaleAlternateLinks {
  static async build(path: string, canonical: string): Promise<Record<string, string> | undefined> {
    const origin = LocaleAlternateLinks.origin(canonical);
    if (!origin) return undefined;
    const { strategy, enabledLocales } = await DynamicPageResolver.getLocaleRoutingConfig();
    if (strategy === LocaleUrlStrategy.NONE || enabledLocales.size < 2) return undefined;
    const defaultLocale = await FrontendLocaleService.readDefaultLocale();
    if (!enabledLocales.has(defaultLocale)) return undefined;
    return LocaleAlternateLinks.links(origin, path, strategy, [...enabledLocales], defaultLocale);
  }

  static links(origin: string, path: string, strategy: LocaleUrlStrategy, locales: string[], defaultLocale: string): Record<string, string> {
    const bare = `/${String(path || '').replace(/^\/+/, '')}`;
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[locale] = `${origin}${LocaleAlternateLinks.localized(bare, locale, strategy, defaultLocale)}`;
    }
    languages['x-default'] = `${origin}${bare}`;
    return languages;
  }

  private static localized(bare: string, locale: string, strategy: LocaleUrlStrategy, defaultLocale: string): string {
    if (locale === defaultLocale) return bare;
    if (strategy === LocaleUrlStrategy.PATH) return bare === '/' ? `/${locale}` : `/${locale}${bare}`;
    return `${bare}?locale=${encodeURIComponent(locale)}`;
  }

  private static origin(canonical: string): string {
    try {
      return canonical ? new URL(canonical).origin : '';
    } catch {
      return '';
    }
  }
}
