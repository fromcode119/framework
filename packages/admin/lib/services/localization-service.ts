import { BaseService } from './base-service';
import { LocalizationUtils } from '@fromcode119/core/client';
import type { ResolveAnyStringOptions } from '@fromcode119/core/client';

/**
 * Service for localization and internationalization.
 * 
 * Handles:
 * - Label text resolution from complex objects
 * - Locale code normalization
 * - Localized text extraction
 */
export class LocalizationService extends BaseService {
  /**
   * Regular expression for locale key validation.
   */
  static readonly LOCALE_KEY_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i;

  /**
   * Deep search utility that attempts to find a display name in any object/structure.
   * 
   * Searches in priority order:
   * 1. Direct string/number/boolean values
   * 2. Common label keys (label, name, title, username, email, slug, value, id)
   * 3. Locale keys (en, en-US, bg, bg-BG, etc.)
   * 4. Array items (recursively)
   * 
   * @example
   * resolveLabelText('Simple String') // "Simple String"
   * resolveLabelText({ label: 'User Name' }) // "User Name"
   * resolveLabelText({ en: 'Hello', bg: 'Здравей' }) // "Hello"
   * resolveLabelText([{ name: 'Item 1' }, { name: 'Item 2' }]) // "Item 1"
   */
  resolveLabelText(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = this.resolveLabelText(item);
        if (resolved) return resolved;
      }
      return '';
    }

    if (typeof value === 'object') {
      // Try direct label keys first
      const directKeys = ['label', 'name', 'title', 'username', 'email', 'slug', 'value', 'id'];
      for (const key of directKeys) {
        const resolved = this.resolveLabelText((value as any)[key]);
        if (resolved) return resolved;
      }

      // Try locale keys
      const entries = Object.entries(value as Record<string, any>);
      const localeEntries = entries.filter(([key]) =>
        LocalizationService.LOCALE_KEY_RE.test(String(key).trim().toLowerCase())
      );
      for (const [, localeValue] of localeEntries) {
        const resolved = this.resolveLabelText(localeValue);
        if (resolved) return resolved;
      }
    }

    return '';
  }

  /**
   * Normalize locale code to standard format.
   * 
   * @example
   * normalizeLocaleCode('en') // "en"
   * normalizeLocaleCode('EN-us') // "en-US"
   */
  normalizeLocaleCode(code: string): string {
    return LocalizationUtils.normalizeLocaleCode(code);
  }

  parseLocaleRegistry(settings: Record<string, unknown> | null | undefined): Array<{ code: string; label: string }> {
    const parsed: Array<{ code: string; label: string }> = [];
    const raw = settings?.localization_locales;

    if (Array.isArray(raw)) {
      this.ingestLocaleRegistryItems(parsed, raw);
      return parsed;
    }

    if (typeof raw === 'string' && raw.trim()) {
      try {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          this.ingestLocaleRegistryItems(parsed, items);
        }
      } catch {
        return parsed;
      }

      return parsed;
    }

    if (raw && typeof raw === 'object') {
      const values = Object.values(raw);
      if (values.length && values.every((item) => item && typeof item === 'object')) {
        this.ingestLocaleRegistryItems(parsed, values);
      }
    }

    return parsed;
  }

  resolveAdminLocale(
    settings: Record<string, unknown> | null | undefined,
    localeRegistry?: Array<{ code: string; label: string }>
  ): string {
    return this.resolvePreferredLocale(settings, localeRegistry, ['admin_default_locale', 'default_locale']);
  }

  resolveFrontendLocale(
    settings: Record<string, unknown> | null | undefined,
    localeRegistry?: Array<{ code: string; label: string }>
  ): string {
    return this.resolvePreferredLocale(settings, localeRegistry, ['frontend_default_locale', 'default_locale']);
  }

  /**
   * Check if a value is a locale map (object with locale code keys).
   *
   * @example
   * isLocaleMap({ en: 'Hello', bg: 'Здравей' }) // true
   * isLocaleMap('plain string') // false
   */
  isLocaleMap(value: unknown): boolean {
    return LocalizationUtils.isLocaleMap(value);
  }

  /**
   * Try to parse a JSON string as a locale map. Returns null if it's not valid JSON
   * or not a locale map.
   *
   * @example
   * tryParseLocaleJson('{"en":"Hello","bg":"Здравей"}') // { en: 'Hello', bg: 'Здравей' }
   * tryParseLocaleJson('plain string') // null
   */
  tryParseLocaleJson(value: unknown): Record<string, unknown> | null {
    return LocalizationUtils.tryParseLocaleJson(value);
  }

  /**
   * Resolve any string value — if it's a locale map, return the best matching locale string.
   *
   * @example
   * resolveAnyString({ en: 'Hello', bg: 'Здравей' }) // "Hello"
   * resolveAnyString('plain') // "plain"
   */
  resolveAnyString(value: unknown, locale?: string): string {
    const options: ResolveAnyStringOptions = locale ? { preferredLocale: locale } : {};
    return LocalizationUtils.resolveAnyString(value, options);
  }

  /**
   * Check if a key looks like a locale code.
   * 
   * @example
   * isLocaleLikeKey('en') // true
   * isLocaleLikeKey('en-US') // true
   * isLocaleLikeKey('username') // false
   */
  isLocaleLikeKey(key: string): boolean {
    return LocalizationUtils.isLocaleMap(key);
  }

  /**
   * Resolve localized text from an object.
   * 
   * @example
   * resolveLocalizedText({ en: 'Hello', bg: 'Здравей' }, 'en') // "Hello"
   * resolveLocalizedText({ en: 'Hello', bg: 'Здравей' }, 'bg') // "Здравей"
   */
  resolveLocalizedText(value: any, locale: string): string {
    return LocalizationUtils.resolveLabelText(value, locale);
  }

  readLocalizedValue(value: unknown, locale: string): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    const normalizedLocale = LocalizationUtils.normalizeLocaleCode(locale, { short: true });
    if (!normalizedLocale) {
      return '';
    }

    const map = this.toLocaleMap(value);
    return String(map[normalizedLocale] || '').trim();
  }

  writeLocalizedValue(currentValue: unknown, locale: string, nextValue: string): Record<string, string> {
    const normalizedLocale = LocalizationUtils.normalizeLocaleCode(locale, { short: true });
    const nextMap = this.toLocaleMap(currentValue, normalizedLocale);
    if (!normalizedLocale) {
      return nextMap;
    }

    nextMap[normalizedLocale] = String(nextValue || '');
    return nextMap;
  }

  toLocaleMap(value: unknown, locale?: string): Record<string, string> {
    if (LocalizationUtils.isLocaleMap(value)) {
      return Object.entries(value as Record<string, unknown>).reduce((acc, [key, entry]) => {
        const normalized = LocalizationUtils.normalizeLocaleCode(key, { short: true });
        if (normalized) {
          acc[normalized] = String(entry || '');
        }
        return acc;
      }, {} as Record<string, string>);
    }

    if (typeof value === 'string' && value.trim() && locale) {
      return { [locale]: value.trim() };
    }

    return {};
  }

  private ingestLocaleRegistryItems(target: Array<{ code: string; label: string }>, items: unknown[]): void {
    items.forEach((item) => {
      const code = this.normalizeLocaleCode(
        String(
          (item as Record<string, unknown>)?.code
          || (item as Record<string, unknown>)?.isoCode
          || (item as Record<string, unknown>)?.locale
          || ''
        )
      );
      if (!code || (item as Record<string, unknown>)?.enabled === false || target.some((entry) => entry.code === code)) {
        return;
      }

      target.push({
        code,
        label: String((item as Record<string, unknown>)?.name || code).trim() || code.toUpperCase(),
      });
    });
  }

  private resolvePreferredLocale(
    settings: Record<string, unknown> | null | undefined,
    localeRegistry: Array<{ code: string; label: string }> | undefined,
    keys: string[]
  ): string {
    for (const key of keys) {
      const normalized = LocalizationUtils.normalizeLocaleCode(String(settings?.[key] || ''), { short: true });
      if (normalized) {
        return normalized;
      }
    }

    return String(localeRegistry?.[0]?.code || '').trim();
  }
}
