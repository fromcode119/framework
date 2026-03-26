import { BrowserStateClient, CookieConstants, LocalizationUtils } from '@fromcode119/core/client';
import type { PreferredLocaleOptions } from './browser-localization.interfaces';


export class BrowserLocalization {
  private static readonly browserState = new BrowserStateClient();

  static getPreferredBrowserLocale(options: PreferredLocaleOptions = {}): string {
    const fallback = LocalizationUtils.normalizeLocaleCode(options.fallback || 'en', { short: true }) || 'en';
    if (typeof window === 'undefined') return fallback;
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
