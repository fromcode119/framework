import { LocalizationPageUtils } from '@/app/settings/localization/localization-page-utils';
import type { SystemLocaleOption } from './system-locale-field.types';

/**
 * Builds the {@link SystemLocaleField} dropdown options from the platform localization settings.
 * Prefers the rich `localization_locales` registry (name + enabled flag), falling back to the
 * `enabled_locales` CSV, then to a single English entry — mirroring the Localization settings page
 * so the picker always reflects the same configured locales an admin manages there.
 */
export class SystemLocaleOptionsService {
  static fromSettings(settings: Record<string, any> | null | undefined): SystemLocaleOption[] {
    const map = settings || {};
    const registry = LocalizationPageUtils.parseLocales(this.asString(map.localization_locales));
    const enabledRegistry = registry.filter((locale) => locale.enabled);

    if (enabledRegistry.length) {
      return enabledRegistry.map((locale) => this.toOption(locale.code, locale.name));
    }

    const csvCodes = this.asString(map.enabled_locales)
      .split(',')
      .map((value) => LocalizationPageUtils.normalizeLocaleCode(value))
      .filter(Boolean);

    if (csvCodes.length) {
      return csvCodes.map((code) => this.toOption(code, LocalizationPageUtils.languageNameFromCode(code)));
    }

    return this.fallback();
  }

  static fallback(): SystemLocaleOption[] {
    return [this.toOption('en', 'English')];
  }

  private static toOption(code: string, name: string): SystemLocaleOption {
    const normalized = LocalizationPageUtils.normalizeLocaleCode(code);
    const label = String(name || '').trim() || LocalizationPageUtils.languageNameFromCode(normalized);
    return { label: `${label} (${normalized})`, value: normalized };
  }

  private static asString(value: any): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
}
