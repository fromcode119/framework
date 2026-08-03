import { cookies } from 'next/headers';
import { CookieConstants, LocalizationUtils } from '@fromcode119/core/client';
import { FrontendPublicSettings } from '@/lib/frontend-public-settings';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { LocaleUrlStrategy } from '@fromcode119/core/client';

export class FrontendLocaleService {
  static async readDefaultLocale(): Promise<string> {
    const [frontendDefaultLocale, defaultLocale, fallbackLocale] = await Promise.all([
      FrontendPublicSettings.readSettingValue('frontend_default_locale'),
      FrontendPublicSettings.readSettingValue('default_locale'),
      FrontendPublicSettings.readSettingValue('fallback_locale'),
    ]);

    return FrontendLocaleService.normalize(frontendDefaultLocale)
      || FrontendLocaleService.normalize(defaultLocale)
      || FrontendLocaleService.normalize(fallbackLocale)
      || 'en';
  }

  static async resolveLocale(
    searchParams: Record<string, string | string[] | undefined> | undefined,
    pathLocale: string | undefined,
    strategy: LocaleUrlStrategy,
  ): Promise<string> {
    const normalizedPathLocale = FrontendLocaleService.normalize(pathLocale);
    if (normalizedPathLocale) {
      return normalizedPathLocale;
    }

    if (strategy === LocaleUrlStrategy.QUERY) {
      const fromQuery = FrontendLocaleService.normalize(
        QueryParamUtils.readSearchValue(searchParams, 'locale') || QueryParamUtils.readSearchValue(searchParams, 'lang'),
      );
      if (fromQuery) {
        return fromQuery;
      }
    }

    const cookieStore = await cookies();
    const fromCookie = FrontendLocaleService.normalize(cookieStore.get(CookieConstants.LOCALE)?.value || '');
    if (fromCookie) {
      return fromCookie;
    }

    return FrontendLocaleService.readDefaultLocale();
  }

  /**
   * The locale stamped on `<html lang>` by the root layout — and therefore the locale a theme's
   * browser bundle detects (`FrontendI18nService.detectInitialLocale` reads `document.documentElement.lang`).
   * Server-rendering a theme must resolve copy against THIS locale, or the words painted server-side
   * differ from the words the theme renders after it boots.
   */
  static async resolveDocumentLocale(strategy: LocaleUrlStrategy): Promise<string> {
    return FrontendLocaleService.resolveLocale(undefined, undefined, strategy);
  }

  private static normalize(value: unknown): string {
    return LocalizationUtils.normalizeLocaleCode(String(value || '').trim());
  }
}
