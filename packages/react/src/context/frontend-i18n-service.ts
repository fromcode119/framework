/**
 * Frontend i18n resolution for the plugin/theme runtime. Plugins register their UI translations once
 * as a per-locale map — `registerTranslations({ en: {...}, bg: {...} })` — and the active locale is
 * auto-detected from the rendered document (`<html lang>`); `t()` then resolves the right language.
 *
 * Backward compatible: a flat (non-locale-keyed) dict still works — it is stored under the wildcard
 * bucket and applies to every locale, so plugins that have not migrated keep functioning. This
 * replaces the old per-plugin `document.documentElement.lang` overlay hack.
 */
export class FrontendI18nService {
  static readonly WILDCARD = '*';

  /** A registration payload is a per-locale map when every top-level key is a locale code
   * (e.g. `en`, `bg`, `pt-BR`) and every value is a plain object. Plugin namespaces (`ecommerce`,
   * `mlm`, …) are never 2-letter codes, so a flat namespaced dict is correctly treated as legacy. */
  static isLocaleMap(input: Record<string, any>): boolean {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const keys = Object.keys(input);
    if (keys.length === 0) return false;
    return keys.every(
      (key) =>
        /^[a-z]{2}(-[A-Za-z]{2})?$/.test(key) &&
        input[key] &&
        typeof input[key] === 'object' &&
        !Array.isArray(input[key]),
    );
  }

  /** Fold a `registerTranslations` call into the per-locale store. A per-locale map lands in each
   * locale bucket; a flat (legacy) dict lands in the wildcard bucket so it applies to every locale. */
  static foldRegistration(
    prev: Record<string, Record<string, any>>,
    input: Record<string, any>,
  ): Record<string, Record<string, any>> {
    if (!input || typeof input !== 'object') return prev;
    const next: Record<string, Record<string, any>> = { ...prev };
    if (FrontendI18nService.isLocaleMap(input)) {
      for (const [loc, dict] of Object.entries(input)) {
        const key = FrontendI18nService.normalizeLocale(loc);
        next[key] = FrontendI18nService.deepMerge(next[key] || {}, dict as Record<string, any>);
      }
    } else {
      next[FrontendI18nService.WILDCARD] = FrontendI18nService.deepMerge(
        next[FrontendI18nService.WILDCARD] || {},
        input,
      );
    }
    return next;
  }

  /** Effective dict for the active locale: server translations first, then locale-agnostic
   * registrations, then the active locale's registrations (most specific wins). */
  static resolveEffective(
    server: Record<string, any>,
    registeredByLocale: Record<string, Record<string, any>>,
    locale: string,
  ): Record<string, any> {
    const norm = FrontendI18nService.normalizeLocale(locale);
    const base = FrontendI18nService.baseLocale(norm);
    const localeDict = registeredByLocale[norm] || registeredByLocale[base] || {};
    return FrontendI18nService.deepMerge(
      FrontendI18nService.deepMerge(server || {}, registeredByLocale[FrontendI18nService.WILDCARD] || {}),
      localeDict,
    );
  }

  /** Auto-detect the active locale from the rendered document (`<html lang>`, set by the framework
   * per the configured locale), falling back to `fallback` when unavailable (e.g. SSR). */
  static detectInitialLocale(fallback = 'en'): string {
    if (typeof document !== 'undefined') {
      const lang = String(document.documentElement?.lang || '').trim();
      if (lang) return FrontendI18nService.normalizeLocale(lang);
    }
    return FrontendI18nService.normalizeLocale(fallback);
  }

  static normalizeLocale(locale: string): string {
    return String(locale || '').trim().toLowerCase() || 'en';
  }

  static baseLocale(locale: string): string {
    return FrontendI18nService.normalizeLocale(locale).split('-')[0];
  }

  static deepMerge(a: Record<string, any>, b: Record<string, any>): Record<string, any> {
    if (!b || typeof b !== 'object') return a || {};
    const out: Record<string, any> = { ...(a || {}) };
    for (const [key, value] of Object.entries(b)) {
      if (
        value && typeof value === 'object' && !Array.isArray(value) &&
        out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])
      ) {
        out[key] = FrontendI18nService.deepMerge(out[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
}
