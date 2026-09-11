import bg from '@/i18n/bg.json';
import en from '@/i18n/en.json';

/**
 * The admin console's OWN copy, bundled with the console.
 *
 * `/system/i18n` cannot serve these: it returns plugin dictionaries, filtered to the plugins that are
 * active — so on a fresh installation, where the first screen an operator ever sees runs before there
 * is a database row, let alone a plugin, it answers `{}`. Chrome strings belong to the app anyway;
 * they ship with it and are readable before anything is configured.
 *
 * The locales the console offers are the dictionaries it ships. There is no second list to keep in
 * step: adding `de.json` and importing it here is the whole of adding German.
 */
export class AdminDictionary {
  private static readonly DICTIONARIES: Record<string, unknown> = { en, bg };

  /** The fallback is English because that is the dictionary every key is authored in. */
  static readonly FALLBACK_LOCALE = 'en';

  static get locales(): string[] {
    return Object.keys(AdminDictionary.DICTIONARIES);
  }

  static has(locale: string): boolean {
    return Object.prototype.hasOwnProperty.call(AdminDictionary.DICTIONARIES, AdminDictionary.normalize(locale));
  }

  /**
   * The language's name IN that language, which is what a chooser must show: someone who only reads
   * Bulgarian needs to find "Български", not "Bulgarian". `Intl.DisplayNames` owns those names; the
   * tag itself is the answer when a runtime cannot name it.
   */
  static label(locale: string): string {
    const normalized = AdminDictionary.normalize(locale);
    try {
      return new Intl.DisplayNames([normalized], { type: 'language' }).of(normalized) || normalized;
    } catch {
      return normalized;
    }
  }

  /**
   * A missing key returns the English string, and a key missing there too returns the key itself —
   * visible in the UI on purpose, because a blank label hides the mistake.
   */
  static translate(locale: string, key: string): string {
    const fromLocale = AdminDictionary.read(AdminDictionary.normalize(locale), key);
    if (fromLocale) return fromLocale;
    return AdminDictionary.read(AdminDictionary.FALLBACK_LOCALE, key) || key;
  }

  private static read(locale: string, key: string): string {
    let cursor: unknown = AdminDictionary.DICTIONARIES[locale];
    for (const segment of key.split('.')) {
      if (!cursor || typeof cursor !== 'object') return '';
      cursor = (cursor as Record<string, unknown>)[segment];
    }
    return typeof cursor === 'string' ? cursor : '';
  }

  private static normalize(locale: string): string {
    return String(locale || '').trim().toLowerCase().split('-')[0];
  }
}
