import { Platform } from '@fromcode119/reactor';
import { BrowserStateClient, CookieConstants, LocalizationUtils } from '@fromcode119/core/client';
import type { IPreferredLocaleOptions } from '@react/interfaces/preferred-locale-options.interface';

export class BrowserLocalization {
  private static readonly browserState = new BrowserStateClient();

  static getPreferredBrowserLocale(options: IPreferredLocaleOptions = {}): string {
    const fallback = LocalizationUtils.normalizeLocaleCode(options.fallback || 'en', { short: true }) || 'en';
    if (!Platform.isBrowser) return fallback;
    const queryParam = String(options.queryParam || 'locale').trim() || 'locale';
    const cookieName = String(options.cookieName || CookieConstants.LOCALE).trim() || CookieConstants.LOCALE;
    try {
      const searchLocale = BrowserLocalization.browserState.readQueryParamFromWindow(queryParam);
      const cookieLocale = BrowserLocalization.browserState.readCookie(cookieName);
      return (
        LocalizationUtils.normalizeLocaleCode(searchLocale, { short: true }) ||
        LocalizationUtils.normalizeLocaleCode(cookieLocale, { short: true }) ||
        LocalizationUtils.normalizeLocaleCode(navigator.language, { short: true }) ||
        fallback
      );
    } catch {
      return fallback;
    }
  }
}
