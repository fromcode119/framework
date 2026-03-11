import { LocalizationUtils } from '@fromcode119/sdk';
import type { PreferredLocaleOptions } from './browser-localization.interfaces';


export class BrowserLocalization {
  static getPreferredBrowserLocale(options: PreferredLocaleOptions = {}): string {
    const fallback = LocalizationUtils.normalizeLocaleCode(options.fallback || 'en', { short: true }) || 'en';
    if (typeof window === 'undefined') return fallback;
    const queryParam = String(options.queryParam || 'locale').trim() || 'locale';
    const cookieName = String(options.cookieName || 'fc_locale').trim() || 'fc_locale';
    try {
      const searchLocale = new URLSearchParams(window.location.search).get(queryParam);
      const cookieLocale = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${cookieName}=`))
        ?.split('=')
        .slice(1)
        .join('=');
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


