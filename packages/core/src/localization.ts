import { BrowserStateClient } from './clients/browser-state-client';
import { CookieConstants } from './cookie-constants';
import { CoercionUtils } from './coercion-utils';
import type { NormalizeLocaleOptions, ResolveAnyStringOptions } from './localization.interfaces';

/**
 * Utilities for locale code normalisation, localised value detection, and
 * resolving values from locale maps.
 *
 * @example
 * LocalizationUtils.normalizeLocaleCode('en_US')                         // 'en-us'
 * LocalizationUtils.normalizeLocaleCode('en_US', { short: true })        // 'en'
 * LocalizationUtils.resolveLabel({ en: 'Hello', bg: 'Здрасти' }, 'bg')  // 'Здрасти'
 * LocalizationUtils.isLocaleMap({ en: 'Hello' })                         // true
 * LocalizationUtils.resolveAnyString({ en: 'Hi' })                       // 'Hi'
 */
export class LocalizationUtils {
  static resolveRuntimeLocale(
    settings: Record<string, unknown> | null | undefined,
    options: {
      storageKey?: string;
      queryKeys?: string[];
      defaultLocale?: string;
    } = {},
  ): string {
    const browserState = new BrowserStateClient();
    const queryKeys = Array.isArray(options.queryKeys) && options.queryKeys.length
      ? options.queryKeys
      : ['locale', 'lang'];
    const storageKey = String(options.storageKey || CookieConstants.LOCALE).trim() || CookieConstants.LOCALE;
    const sources = [
      ...queryKeys.map((key) => browserState.readQueryParamFromWindow(key)),
      String(settings?.frontend_default_locale || '').trim(),
      browserState.readLocalString(storageKey),
      browserState.readCookie(storageKey),
      typeof document !== 'undefined' ? String(document.documentElement.lang || '').trim() : '',
      typeof navigator !== 'undefined' ? String(navigator.language || '').trim() : '',
      String(options.defaultLocale || '').trim(),
    ];

    for (const source of sources) {
      const normalized = LocalizationUtils.normalizeLocaleCode(source, { short: true });
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  static normalizeLocaleCode(value: unknown, options: NormalizeLocaleOptions = {}): string {
    const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    if (!raw) return '';
    if (options.short) {
      const short = raw.split('-')[0];
      return /^[a-z]{2}$/.test(short) ? short : '';
    }
    if (/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/.test(raw)) return raw;
    const short = raw.split('-')[0];
    return /^[a-z]{2}$/.test(short) ? short : '';
  }

  static hasLocalizedValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return (value as string).trim().length > 0;
    return true;
  }

  static tryParseLocaleJson(value: unknown): Record<string, unknown> | null {
    const raw = String(value ?? '').trim();
    if (!raw.startsWith('{') || !raw.endsWith('}')) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  static isLocaleMap(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value as object);
    if (!keys.length) return false;
    return keys.every((key) => Boolean(LocalizationUtils.normalizeLocaleCode(key)));
  }

  static resolveLabel(value: unknown, locale: string, fallback = 'en'): string {
    if (typeof value === 'string') {
      const parsed = LocalizationUtils.tryParseLocaleJson(value);
      if (!parsed) return (value as string).trim();
      value = parsed;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return String(value || '').trim();
    }

    const localeCode = LocalizationUtils.normalizeLocaleCode(locale, { short: true });
    const fallbackCode = LocalizationUtils.normalizeLocaleCode(fallback, { short: true }) || 'en';

    const normalized: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      const code = LocalizationUtils.normalizeLocaleCode(key, { short: true });
      if (code) normalized[code] = entry;
    });

    if (LocalizationUtils.hasLocalizedValue(normalized[localeCode])) return String(normalized[localeCode]).trim();
    if (LocalizationUtils.hasLocalizedValue(normalized[fallbackCode])) return String(normalized[fallbackCode]).trim();
    const first = Object.values(normalized).find((entry) => LocalizationUtils.hasLocalizedValue(entry));
    return first !== undefined ? String(first).trim() : '';
  }

  static resolveAnyString(value: unknown, options: ResolveAnyStringOptions = {}): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return (value as string).trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();

    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = LocalizationUtils.resolveAnyString(item, options);
        if (resolved) return resolved;
      }
      return '';
    }

    if (typeof value !== 'object') return String(value).trim();

    if (LocalizationUtils.isLocaleMap(value)) {
      const preferredLocale = LocalizationUtils.normalizeLocaleCode(
        options.preferredLocale || (typeof navigator !== 'undefined' ? navigator.language : ''),
      );
      const fallbackLocale = LocalizationUtils.normalizeLocaleCode(options.fallbackLocale || 'en');
      const preferredShort = preferredLocale.split('-')[0];
      const fallbackShort = fallbackLocale.split('-')[0];

      const map = value as Record<string, unknown>;
      const direct =
        LocalizationUtils.resolveAnyString(map[preferredLocale], options) ||
        LocalizationUtils.resolveAnyString(map[preferredShort], options) ||
        LocalizationUtils.resolveAnyString(map[fallbackLocale], options) ||
        LocalizationUtils.resolveAnyString(map[fallbackShort], options);
      if (direct) return direct;

      for (const localeValue of Object.values(map)) {
        const resolved = LocalizationUtils.resolveAnyString(localeValue, options);
        if (resolved) return resolved;
      }
      return '';
    }

    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const resolved = LocalizationUtils.resolveAnyString(nestedValue, options);
      if (resolved) return resolved;
    }
    return '';
  }

  /** Resolve a value that may be a locale map, string, or number to a display string. */
  static resolveLabelText(value: unknown, locale?: string): string {
    if (!locale) return LocalizationUtils.resolveAnyString(value);
    return LocalizationUtils.resolveLabel(value, locale);
  }

  // ── Registry + per-field locale helpers ─────────────────────────────────────

  /** Parse the active locale registry from a settings record. Reads
   * `localization_locales`: accepts an array, a JSON string, or a values-only
   * object. Returns [{code, label}] entries; skips disabled or duplicates. */
  static parseLocaleRegistry(
    settings: Record<string, unknown> | null | undefined,
  ): Array<{ code: string; label: string }> {
    const out: Array<{ code: string; label: string }> = [];
    const raw: any = settings?.localization_locales;
    const ingest = (items: any[]) => {
      for (const item of items) {
        const code = LocalizationUtils.normalizeLocaleCode(
          String((item as any)?.code || (item as any)?.isoCode || (item as any)?.locale || ''),
        );
        if (!code || (item as any)?.enabled === false || out.some((e) => e.code === code)) continue;
        out.push({ code, label: String((item as any)?.name || code).trim() || code.toUpperCase() });
      }
    };
    if (Array.isArray(raw)) ingest(raw);
    else if (typeof raw === 'string' && raw.trim()) {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) ingest(parsed); } catch { /* noop */ }
    } else if (raw && typeof raw === 'object') {
      const values = Object.values(raw);
      if (values.length && values.every((item) => item && typeof item === 'object')) ingest(values);
    }
    return out;
  }

  /** Resolve the default locale code for a given scope by reading settings. */
  static resolveAdminLocale(
    settings: Record<string, unknown> | null | undefined,
    registry?: Array<{ code: string; label: string }>,
  ): string {
    return LocalizationUtils.resolvePreferredLocale(settings, registry, ['admin_default_locale', 'default_locale']);
  }

  static resolveFrontendLocale(
    settings: Record<string, unknown> | null | undefined,
    registry?: Array<{ code: string; label: string }>,
  ): string {
    return LocalizationUtils.resolvePreferredLocale(settings, registry, ['frontend_default_locale', 'default_locale']);
  }

  private static resolvePreferredLocale(
    settings: Record<string, unknown> | null | undefined,
    registry: Array<{ code: string; label: string }> | undefined,
    keys: string[],
  ): string {
    for (const key of keys) {
      const normalized = LocalizationUtils.normalizeLocaleCode(String(settings?.[key] || ''), { short: true });
      if (normalized) return normalized;
    }
    return String(registry?.[0]?.code || '').trim();
  }

  /** Read the value for a specific locale from a possibly-localized field. */
  static readLocalizedValue(value: unknown, locale: string): string {
    if (typeof value === 'string') return value.trim();
    const normalized = LocalizationUtils.normalizeLocaleCode(locale, { short: true });
    if (!normalized) return '';
    const map = LocalizationUtils.toLocaleMap(value);
    return String(map[normalized] || '').trim();
  }

  /** Patch a single locale slot on a field value, returning a new locale map. */
  static writeLocalizedValue(currentValue: unknown, locale: string, nextValue: string): Record<string, string> {
    const normalized = LocalizationUtils.normalizeLocaleCode(locale, { short: true });
    const nextMap = LocalizationUtils.toLocaleMap(currentValue, normalized);
    if (!normalized) return nextMap;
    nextMap[normalized] = String(nextValue || '');
    return nextMap;
  }

  static toLocaleMap(value: unknown, locale?: string): Record<string, string> {
    if (LocalizationUtils.isLocaleMap(value)) {
      return Object.entries(value as Record<string, unknown>).reduce((acc, [key, entry]) => {
        const normalized = LocalizationUtils.normalizeLocaleCode(key, { short: true });
        if (normalized) acc[normalized] = String(entry || '');
        return acc;
      }, {} as Record<string, string>);
    }
    if (typeof value === 'string' && value.trim() && locale) return { [locale]: value.trim() };
    return {};
  }
}
