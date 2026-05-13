import { cookies } from 'next/headers';
import { CookieConstants, LocalizationUtils } from '@fromcode119/core/client';
import { FrontendPublicSettings } from './frontend-public-settings';
import { QueryParamUtils } from './query-param-utils';
import type { LocaleStrategy, SearchParams } from './dynamic-page-resolver.types';

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
    searchParams: SearchParams | undefined,
    pathLocale: string | undefined,
    strategy: LocaleStrategy,
  ): Promise<string> {
    const normalizedPathLocale = FrontendLocaleService.normalize(pathLocale);
    if (normalizedPathLocale) {
      return normalizedPathLocale;
    }

    if (strategy === 'query') {
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

  private static normalize(value: unknown): string {
    return LocalizationUtils.normalizeLocaleCode(String(value || '').trim());
  }
}
