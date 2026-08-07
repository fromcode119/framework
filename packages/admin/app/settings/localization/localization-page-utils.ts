import { CoercionUtils } from '@fromcode119/core/client';

/**
 * Utility class for localization settings page operations.
 * Handles locale parsing, normalization, and language name resolution.
 */
export class LocalizationPageUtils {
  /**
   * Normalizes a locale code to lowercase with hyphens.
   * 
   * @param code - Locale code (e.g., 'en_US', 'en-us')
   * @returns Normalized code (e.g., 'en-us')
   * 
   * @example
   * const normalized = LocalizationPageUtils.normalizeLocaleCode('en_US'); // "en-us"
   * const hyphen = LocalizationPageUtils.normalizeLocaleCode('EN-GB'); // "en-gb"
   */
  static normalizeLocaleCode(code: string): string {
    return String(code || '').trim().toLowerCase().replace(/_/g, '-');
  }

  /**
   * Resolves a human-readable language name from a locale code.
   * 
   * @param code - Locale code (e.g., 'en', 'bg')
   * @returns Language name (e.g., 'English', 'Bulgarian')
   * 
   * @example
   * const name = LocalizationPageUtils.languageNameFromCode('en'); // "English"
   * const bgName = LocalizationPageUtils.languageNameFromCode('bg'); // "Bulgarian"
   */
  static languageNameFromCode(code: string): string {
    const normalized = LocalizationPageUtils.normalizeLocaleCode(code);
    if (!normalized) return '';
    const base = normalized.split('-')[0];
    try {
      const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
      return displayNames.of(base) || normalized.toUpperCase();
    } catch {
      return normalized.toUpperCase();
    }
  }

  /**
   * Parses locale configuration from JSON or structured data.
   *
   * @param value - Locale configuration (string or array)
   * @returns Array of locale items with id, code, name, enabled
   *
   * @example
   * const locales = LocalizationPageUtils.parseLocales('[{"code":"en","enabled":true}]');
   * // => [{ id: "en-0", code: "en", name: "English", enabled: true }]
   */
  static parseLocales(value: unknown): Array<{ id: string; code: string; name: string; enabled: boolean }> {
    const parsed = LocalizationPageUtils.toStoredArray(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any, index: number) => {
        const code = LocalizationPageUtils.normalizeLocaleCode(
          item?.code || item?.isoCode || item?.locale
        );
        if (!code) return null;
        return {
          id: `${code}-${index}`,
          code,
          name: String(item?.name || item?.label || LocalizationPageUtils.languageNameFromCode(code)),
          enabled: item?.enabled !== false
        };
      })
      .filter((item): item is { id: string; code: string; name: string; enabled: boolean } => item !== null);
  }

  /**
   * Normalize the stored registry to the array the caller maps over.
   *
   * `GET /system/admin/settings` returns JSON-shaped settings **already parsed**
   * (`SystemSettingsExposureUtils.toExposableSettingsMap(rows, { parseJson: true })`), so this normally
   * arrives as a real array. Coercing it with `String(value)` first — which is what this did — turned it
   * into `"[object Object],[object Object]"`, `JSON.parse` threw, and the whole Localization screen died
   * with "not valid JSON" while the stored row was perfectly valid. A string is still accepted so a raw
   * (unparsed) value keeps working.
   */
  private static toStoredArray(value: unknown): unknown {
    if (Array.isArray(value)) return value;
    const raw = CoercionUtils.toString(value);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // A corrupt stored value is a LOAD FAILURE, not "no locales configured". This used to be a
      // bare `catch {}`, so the registry rendered empty and a subsequent Save overwrote the real
      // (unreadable) configuration with whatever the operator typed into that empty form.
      throw new Error('The stored locale registry could not be read: `localization_locales` is not valid JSON.');
    }
  }
}
