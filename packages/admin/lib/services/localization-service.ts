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
}