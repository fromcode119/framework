import { TranslationMap } from '../types';
import { RequestContextUtils } from '../context/request-context';

export class I18nManager {
  public translations: Map<string, TranslationMap> = new Map();
  private currentLocale: string;

  constructor(defaultLocale: string = 'en') {
    this.currentLocale = defaultLocale;
  }

  registerTranslations(locale: string, namespace: string, translations: TranslationMap) {
    if (!this.translations.has(locale)) {
      this.translations.set(locale, {});
    }
    const localeMap = this.translations.get(locale)!;
    localeMap[namespace] = translations;
  }

  setLocale(locale: string) {
    this.currentLocale = locale;
  }

  /**
   * The platform's configured default locale — seeded from the `default_locale` system setting at boot
   * (admin Settings → Localization). Use this for server-rendered legal/official documents (invoices,
   * payout statements) that must render in the PLATFORM language, not the viewer's request locale.
   */
  getDefaultLocale(): string {
    return this.currentLocale;
  }

  translate(key: string, params: Record<string, any> = {}, locale?: string): string {
    const targetLocale = locale || RequestContextUtils.getLocale() || this.currentLocale;
    const localeMap = this.translations.get(targetLocale) || this.translations.get('en');
    
    if (!localeMap) return key;

    let value: any = localeMap;
    const parts = key.split('.');
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return key;
      }
    }

    if (typeof value !== 'string') return key;

    // Handle variables: {{name}}
    return value.replace(/\{\{(.+?)\}\}/g, (_, match) => {
      const paramKey = match.trim();
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
    });
  }

  translateOrFallback(
    key: string,
    fallback: string,
    params: Record<string, any> = {},
    locale?: string,
  ): string {
    const translated = String(this.translate(key, params, locale) || '').trim();
    if (!translated || translated === key) {
      return String(fallback || '').trim();
    }

    return translated;
  }
}
