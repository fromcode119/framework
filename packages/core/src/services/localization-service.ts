import { BaseService } from './base-service';

/**
 * Localization Service.
 * 
 * Provides utilities for locale handling, normalization, and localized text resolution.
 * 
 * @example
 * ```typescript
 * import { CoreServices } from '@fromcode119/core';
 * 
 * const services = CoreServices.getInstance();
 * const locale = services.localization.normalizeLocale('en_US'); // "en-us"
 * const text = services.localization.resolveText({ en: 'Hello', bg: 'Здравей' }, 'en');
 * ```
 */
export class LocalizationService extends BaseService {
  get serviceName(): string {
    return 'LocalizationService';
  }

  /**
   * Normalizes locale codes to a standard format.
   * Example: "en_US" -> "en-us"
   */
  normalizeLocale(value: any): string {
    return String(value || '').trim().toLowerCase().replace(/_/g, '-');
  }

  /**
   * Validates if a string looks like a locale key.
   * Examples: "en", "en-US", "zh-Hans-CN"
   */
  isLocaleKey(key: string): boolean {
    return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(String(key || '').trim());
  }

  /**
   * Checks if a value is meaningful for localization.
   * Returns false for empty strings, null, undefined, empty objects/arrays.
   */
  isMeaningful(value: any): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }

  /**
   * Resolves localized text from a map or string based on preferred locale.
   * 
   * Resolution strategy:
   * 1. Try exact locale match (e.g., "en-us")
   * 2. Try language-only match (e.g., "en")
   * 3. Fallback to first available value
   * 
   * @param value - String, number, or locale map { en: "Hello", bg: "Здравей" }
   * @param preferredLocale - Preferred locale code (e.g., "en-us")
   * @returns Resolved text string
   */
  resolveText(value: any, preferredLocale?: string): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = this.resolveText(item, preferredLocale);
        if (resolved) return resolved;
      }
      return '';
    }

    if (typeof value !== 'object') return '';

    const normalizedLocale = this.normalizeLocale(preferredLocale);

    // 1. Try exact match (e.g., "en-us")
    if (normalizedLocale && value[normalizedLocale]) {
      return this.resolveText(value[normalizedLocale], '');
    }

    // 2. Try language-only match (e.g., "en")
    const langOnly = normalizedLocale.split('-')[0];
    if (langOnly && value[langOnly]) {
      return this.resolveText(value[langOnly], '');
    }

    // 3. Fallback to first available value
    const values = Object.values(value);
    for (const localizedValue of values) {
      const resolved = this.resolveText(localizedValue, '');
      if (resolved) return resolved;
    }

    return '';
  }
}