/**
 * Frontend i18n resolution for the plugin/theme runtime. Plugins register their UI translations once
 * as a per-locale map — `registerTranslations({ en: {...}, bg: {...} })` — and the active locale is
 * auto-detected from the rendered document (`<html lang>`); `t()` then resolves the right language.
 *
 * Backward compatible: a flat (non-locale-keyed) dict still works — it is stored under the wildcard
 * bucket and applies to every locale, so plugins that have not migrated keep functioning. This
 * replaces the old per-plugin `document.documentElement.lang` overlay hack.
 *
 * ONE registration call, `registerTranslations(payload, layer)`, for plugins and themes alike. The
 * second argument names which LAYER the copy belongs to — `registerTranslations(dict, 'theme')` from a
 * theme, nothing (i.e. the plugin layer) from a plugin. {@link resolveEffective} then merges the layers
 * in a fixed order. See that method for why the layer cannot be inferred from load order.
 */
import { Platform } from '@fromcode119/react-class-components';

export class FrontendI18nService {
  static readonly WILDCARD = '*';

  /** The override layer — what a theme passes as the second argument to `registerTranslations`. */
  static readonly THEME_LAYER = 'theme';

  /** A registration payload is a per-locale map when every top-level key is a locale code
   * (e.g. `en`, `bg`, `pt-BR`) and every value is a plain object. Plugin namespaces are
   * never 2-letter codes, so a flat namespaced dict is correctly treated as legacy. */
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

  /**
   * Effective dict for the active locale, merged in LAYER order — server, then plugins, then theme.
   *
   * The layer is DECLARED by the caller (`registerTranslations(dict, 'theme')`) rather than inferred
   * from when it registered, because both plugins and themes register as a side effect of their bundle
   * being imported and the plugin bundle evaluates last (`ThemeServerRenderer` imports plugins after
   * the theme, deliberately). Ordering alone therefore made the PLUGIN win every collision — the exact
   * inverse of "Plugin Owns Default Design — Theme Is Only an Override": a theme's copy silently lost
   * to the plugin default it was written to replace.
   *
   * Within a layer the order is unchanged: locale-agnostic (wildcard) registrations first, then the
   * active locale's (most specific wins). Across layers the whole theme layer beats the whole plugin
   * layer, so a theme override applies whether the theme registered before or after the plugin.
   */
  static resolveEffective(
    server: Record<string, any>,
    registeredByLocale: Record<string, Record<string, any>>,
    locale: string,
    themeByLocale: Record<string, Record<string, any>> = {},
  ): Record<string, any> {
    return FrontendI18nService.deepMerge(
      FrontendI18nService.deepMerge(
        server || {},
        FrontendI18nService.resolveLayer(registeredByLocale, locale),
      ),
      FrontendI18nService.resolveLayer(themeByLocale, locale),
    );
  }

  /** One registration layer flattened for the active locale: wildcard first, active locale over it. */
  static resolveLayer(
    byLocale: Record<string, Record<string, any>>,
    locale: string,
  ): Record<string, any> {
    if (!byLocale) return {};
    const norm = FrontendI18nService.normalizeLocale(locale);
    const base = FrontendI18nService.baseLocale(norm);
    const localeDict = byLocale[norm] || byLocale[base] || {};
    return FrontendI18nService.deepMerge(byLocale[FrontendI18nService.WILDCARD] || {}, localeDict);
  }

  /**
   * Resolve one key against an already-effective dictionary, with `{{token}}` interpolation.
   *
   * The single implementation behind BOTH the browser `t()` (`ContextProviderI18nHooks`) and the
   * server-side translator used to pre-render a theme. Two copies of this lookup would drift, and a
   * drifted lookup shows up as text that changes between the server paint and hydration.
   */
  static translate(
    dictionary: Record<string, any>,
    key: string,
    params: Record<string, any> = {},
    defaultValue?: string,
  ): string {
    let value: any = dictionary;
    for (const part of String(key || '').split('.')) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue || key;
      }
    }

    if (typeof value !== 'string') {
      return defaultValue || key;
    }

    return value.replace(/\{\{(.+?)\}\}/g, (_, match) => {
      const paramKey = match.trim();
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
    });
  }

  /** Auto-detect the active locale from the rendered document (`<html lang>`, set by the framework
   * per the configured locale), falling back to `fallback` when unavailable (e.g. SSR). */
  static detectInitialLocale(fallback = 'en'): string {
    if (Platform.isBrowser) {
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
