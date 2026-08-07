import type { ILoadedLocalization } from '@/app/settings/localization/interfaces/loaded-localization.interface';
import type { ISavedLocalization } from '@/app/settings/localization/interfaces/saved-localization.interface';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { LocalizationPageUtils } from '@/app/settings/localization/localization-page-utils';
import { ILocaleItem } from '@/app/settings/localization/interfaces/locale-item.interface';
import { CoercionUtils, LocaleUrlStrategy, MeasurementSystem } from '@fromcode119/core/client';

/**
 * Loads and persists localization settings for the localization settings page.
 */
export class LocalizationSettingsIo {
  /**
   * Read the stored localization configuration — and ONLY the stored configuration.
   *
   * Every `|| 'en'` that used to live here was an invented fallback: with nothing stored, the Locale
   * Registry showed **English (en)** as a configured locale, every locale dropdown offered it, and
   * "Save Localization" then wrote `en` as the platform's only locale. An empty registry is now
   * returned as empty and the page says so.
   *
   * Rejections propagate — the caller renders a visible load error. It must never fall through to
   * a form full of code-side seeds.
   */
  static async load(): Promise<ILoadedLocalization> {
    const response = await AdminSystemSettingsClient.getAll();
    // Values are kept AS RETURNED. `getSettings` hands back JSON-shaped settings already parsed, so the
    // previous `String(value ?? '')` turned the `localization_locales` array into
    // "[object Object],[object Object]" and the screen died on load with "not valid JSON" — while the
    // stored row was valid. Only the genuinely scalar settings below are coerced to string.
    const settings = new Map<string, unknown>(Object.entries(response || {}));
    const text = (key: string): string => CoercionUtils.toString(settings.get(key));

    return {
      locales: LocalizationPageUtils.parseLocales(settings.get('localization_locales')),
      defaultLocale: LocalizationPageUtils.normalizeLocaleCode(text('default_locale')),
      adminDefaultLocale: LocalizationPageUtils.normalizeLocaleCode(text('admin_default_locale')),
      frontendDefaultLocale: LocalizationPageUtils.normalizeLocaleCode(text('frontend_default_locale')),
      localeUrlStrategy: LocaleUrlStrategy.resolve(text('locale_url_strategy')),
      measurementSystem: MeasurementSystem.resolve(text('measurement_system')),
    };
  }

  /** Options for the "default locale" dropdowns. Empty registry ⇒ empty option list, never a synthetic `en`. */
  static buildSelectOptions(locales: ILocaleItem[]): { value: string; label: string }[] {
    return locales
      .map((locale) => ({
        ...locale,
        code: LocalizationPageUtils.normalizeLocaleCode(locale.code),
        name: String(locale.name || '').trim()
      }))
      .filter((locale) => locale.code && locale.enabled)
      .map((locale) => ({
        value: locale.code,
        label: `${locale.name} (${locale.code})`
      }));
  }

  static cleanLocales(locales: ILocaleItem[]): ILocaleItem[] {
    const dedupe = new Set<string>();
    const cleaned = locales
      .map((locale) => {
        const code = LocalizationPageUtils.normalizeLocaleCode(locale.code);
        const name = String(locale.name || '').trim() || LocalizationPageUtils.languageNameFromCode(code);
        return { ...locale, code, name };
      })
      .filter((locale) => locale.code)
      .filter((locale) => {
        if (dedupe.has(locale.code)) return false;
        dedupe.add(locale.code);
        return true;
      });
    if (cleaned.length && !cleaned.some((locale) => locale.enabled)) {
      cleaned[0].enabled = true;
    }
    return cleaned;
  }

  /**
   * Persist the localization configuration.
   *
   * `measurementSystem` is part of this PUT because the page's own control had NO persistence path at
   * all: it was passed only to `ContextBridge.registerSettings`, a client-side context setter, so the
   * operator got a green "Localization Updated" toast and the value was gone on reload — while
   * `plugins/ecommerce` reads `globalSettings.measurement_system` from the SERVER settings for package
   * dimensions.
   *
   * REQUIRES an api-side change to land with it: `measurement_system` must be added to
   * `SystemAdminController.WRITABLE_SETTINGS_KEYS`
   * (`packages/api/src/controllers/system/system-admin-controller.ts:8-43`) or this PUT is rejected 400
   * "Unknown or read-only settings key(s)". `SystemConstants.META_KEY.MEASUREMENT_SYSTEM` already exists.
   */
  static async save(
    cleaned: ILocaleItem[],
    defaults: { defaultLocale: string; adminDefaultLocale: string; frontendDefaultLocale: string },
    localeUrlStrategy: LocaleUrlStrategy,
    measurementSystem: MeasurementSystem,
  ): Promise<ISavedLocalization> {
    const enabledCodes = cleaned.filter((locale) => locale.enabled).map((locale) => locale.code);
    const firstEnabled = enabledCodes[0];
    const pickDefault = (value: string) => {
      const normalized = LocalizationPageUtils.normalizeLocaleCode(value);
      return enabledCodes.includes(normalized) ? normalized : firstEnabled;
    };

    const nextDefaultLocale = pickDefault(defaults.defaultLocale);
    const nextAdminDefault = pickDefault(defaults.adminDefaultLocale);
    const nextFrontendDefault = pickDefault(defaults.frontendDefaultLocale);

    await AdminSystemSettingsClient.update({
      localization_locales: cleaned.map(({ id, ...rest }) => rest),
      enabled_locales: enabledCodes.join(','),
      default_locale: nextDefaultLocale,
      admin_default_locale: nextAdminDefault,
      frontend_default_locale: nextFrontendDefault,
      locale_url_strategy: localeUrlStrategy.value,
      measurement_system: measurementSystem.value,
    });

    return {
      cleaned,
      enabledCodes,
      defaultLocale: nextDefaultLocale,
      adminDefaultLocale: nextAdminDefault,
      frontendDefaultLocale: nextFrontendDefault,
    };
  }
}
