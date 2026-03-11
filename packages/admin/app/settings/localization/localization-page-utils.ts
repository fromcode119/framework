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
  static parseLocales(value: any): Array<{ id: string; code: string; name: string; enabled: boolean }> {
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
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
      } catch {}
    }
    return [];
  }
}
