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
}