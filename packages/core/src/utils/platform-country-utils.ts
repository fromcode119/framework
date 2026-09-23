import { SystemConstants } from '@core/constants/system.constants';
import { PlatformCountrySource } from '@core/enums/platform-country-source.enum';
import type { IPlatformCountry } from '@core/interfaces/platform-country.interface';

/**
 * The ONE country a site operates in, which every country-aware module inherits.
 *
 * Resolution, in order:
 *   1. the `country` system setting (admin Settings → Localization);
 *   2. otherwise the region of the frontend language (`frontend_default_locale`, then `default_locale`),
 *      by the Unicode likely-subtags rules — `bg` → BG, `de-AT` → AT, `en` → US;
 *   3. otherwise none ('').
 *
 * A module that needs a different country for itself keeps its own setting and passes it as the
 * override to {@link forModule}; a blank override inherits this. Country knowledge here is universal
 * (ISO codes, like measurement units) — no country's rules live in the framework.
 */
export class PlatformCountryUtils {
  /** The framework system-setting key (also present on the admin field renderer's `globalSettings`). */
  static readonly SETTING_KEY = SystemConstants.META_KEY.COUNTRY;
  /** The languages consulted when no country is set, first match wins. */
  static readonly LANGUAGE_KEYS: readonly string[] = [
    SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE,
    SystemConstants.META_KEY.DEFAULT_LOCALE,
  ];

  /** An ISO 3166-1 alpha-2 code, uppercased; anything else (including UN M.49 areas like `001`) is ''. */
  static normalize(value: unknown): string {
    const code = String(value ?? '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : '';
  }

  /** The region a language implies (`bg` → BG, `pt-BR` → BR), or '' when it implies none. */
  static fromLocale(locale: unknown): string {
    const tag = String(locale ?? '').trim().replace(/_/g, '-');
    if (!tag) return '';
    try {
      return PlatformCountryUtils.normalize(new Intl.Locale(tag).maximize().region);
    } catch {
      return '';
    }
  }

  /** Resolve from a settings map (the admin's `globalSettings`, or values read from the meta store). */
  static resolve(settings: Record<string, unknown> | null | undefined): IPlatformCountry {
    const chosen = PlatformCountryUtils.normalize(settings?.[PlatformCountryUtils.SETTING_KEY]);
    if (chosen) return { country: chosen, source: PlatformCountrySource.SETTING, language: '' };

    for (const key of PlatformCountryUtils.LANGUAGE_KEYS) {
      const language = String(settings?.[key] ?? '').trim();
      if (!language) continue;
      const derived = PlatformCountryUtils.fromLocale(language);
      if (derived) return { country: derived, source: PlatformCountrySource.LANGUAGE, language };
    }
    return { country: '', source: PlatformCountrySource.NONE, language: '' };
  }

  /** Resolve server-side through a plugin's `context.meta`. */
  static async read(meta: { get(key: string): Promise<string | null> }): Promise<IPlatformCountry> {
    const keys = [PlatformCountryUtils.SETTING_KEY, ...PlatformCountryUtils.LANGUAGE_KEYS];
    const values = await Promise.all(keys.map((key) => meta.get(key)));
    return PlatformCountryUtils.resolve(Object.fromEntries(keys.map((key, i) => [key, values[i]])));
  }

  /**
   * The country a module runs on: its own override when set, else the platform country.
   *
   * @example
   * const country = await PlatformCountryUtils.forModule(settings.invoiceCountry, context.meta);
   */
  static async forModule(override: unknown, meta: { get(key: string): Promise<string | null> }): Promise<string> {
    return PlatformCountryUtils.normalize(override) || (await PlatformCountryUtils.read(meta)).country;
  }
}
