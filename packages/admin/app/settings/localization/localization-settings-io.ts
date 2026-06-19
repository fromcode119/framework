import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { LocalizationPageUtils } from './localization-page-utils';
import type { LocaleItem, LocaleUrlStrategy } from './localization.types';

interface LoadedLocalization {
  locales: LocaleItem[];
  defaultLocale: string;
  adminDefaultLocale: string;
  frontendDefaultLocale: string;
  localeUrlStrategy: LocaleUrlStrategy;
}

interface SavedLocalization {
  cleaned: LocaleItem[];
  enabledCodes: string[];
  defaultLocale: string;
  adminDefaultLocale: string;
  frontendDefaultLocale: string;
}

/**
 * Loads and persists localization settings for the localization settings page.
 */
export class LocalizationSettingsIo {
  static async load(): Promise<LoadedLocalization> {
    const response = await AdminSystemSettingsClient.getAll();
    const map = new Map<string, string>();
    Object.entries(response || {}).forEach(([key, value]) => {
      map.set(String(key), typeof value === 'string' ? value : JSON.stringify(value));
    });

    let parsedLocales = LocalizationPageUtils.parseLocales(map.get('localization_locales'));
    if (!parsedLocales.length) {
      const enabledCodes = String(map.get('enabled_locales') || 'en')
        .split(',')
        .map((value) => LocalizationPageUtils.normalizeLocaleCode(value))
        .filter(Boolean);
      parsedLocales = (enabledCodes.length ? enabledCodes : ['en']).map((code, index) => ({
        id: `${code}-${index}`,
        code,
        name: LocalizationPageUtils.languageNameFromCode(code),
        enabled: true
      }));
    }

    const enabledCodes = parsedLocales.filter((locale) => locale.enabled).map((locale) => locale.code);
    const firstEnabled = enabledCodes[0] || parsedLocales[0]?.code || 'en';
    const savedStrategy = String(map.get('locale_url_strategy') || 'query').trim().toLowerCase();

    return {
      locales: parsedLocales,
      defaultLocale: LocalizationPageUtils.normalizeLocaleCode(map.get('default_locale') || firstEnabled),
      adminDefaultLocale: LocalizationPageUtils.normalizeLocaleCode(map.get('admin_default_locale') || firstEnabled),
      frontendDefaultLocale: LocalizationPageUtils.normalizeLocaleCode(map.get('frontend_default_locale') || firstEnabled),
      localeUrlStrategy: savedStrategy === 'path' || savedStrategy === 'none' ? savedStrategy : 'query',
    };
  }

  static buildSelectOptions(locales: LocaleItem[]): { value: string; label: string }[] {
    const list = locales
      .map((locale) => ({
        ...locale,
        code: LocalizationPageUtils.normalizeLocaleCode(locale.code),
        name: String(locale.name || '').trim()
      }))
      .filter((locale) => locale.code && locale.enabled);

    const resolved = list.length ? list : [{ id: 'en', code: 'en', name: 'English', enabled: true }];
    return resolved.map((locale) => ({
      value: locale.code,
      label: `${locale.name} (${locale.code})`
    }));
  }

  static cleanLocales(locales: LocaleItem[]): LocaleItem[] {
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

  static async save(
    cleaned: LocaleItem[],
    defaults: { defaultLocale: string; adminDefaultLocale: string; frontendDefaultLocale: string },
    localeUrlStrategy: LocaleUrlStrategy,
  ): Promise<SavedLocalization> {
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
      locale_url_strategy: localeUrlStrategy,
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
