import { normalizeLocaleCode } from '@fromcode/sdk';

export interface PreferredLocaleOptions {
  fallback?: string;
  queryParam?: string;
  cookieName?: string;
}

export function getPreferredBrowserLocale(options: PreferredLocaleOptions = {}): string {
  const fallback = normalizeLocaleCode(options.fallback || 'en', { short: true }) || 'en';
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
      normalizeLocaleCode(searchLocale, { short: true }) ||
      normalizeLocaleCode(cookieLocale, { short: true }) ||
      normalizeLocaleCode(navigator.language, { short: true }) ||
      fallback
    );
  } catch {
    return fallback;
  }
}

