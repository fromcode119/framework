import bg from '@/i18n/bg.json';
import en from '@/i18n/en.json';
import { LocalizationUtils, TextDirection } from '@fromcode119/core/client';

/**
 * The admin console's OWN copy, shipped with the console.
 *
 * `/system/i18n` cannot serve these: it returns plugin dictionaries, filtered to the plugins that are
 * active — so on a fresh installation, where the first screen an operator ever sees runs before there
 * is a database row, let alone a plugin, it answers `{}`. Chrome strings belong to the app anyway;
 * they ship with it and are readable before anything is configured.
 *
 * English and Bulgarian are in the bundle: English is every key's fallback, and Bulgarian carries the
 * slug transliteration table `AdminSlug` reads synchronously. Every other language is a chunk of its
 * own, fetched by `load()` when a reader chooses it — 43 dictionaries in the bundle would make every
 * reader download all of them.
 *
 * The locales the console offers are the dictionaries it ships. There is no second list to keep in
 * step: adding `de.json` and a loader here is the whole of adding German.
 */
export class AdminDictionary {
  private static readonly BUNDLED: Record<string, unknown> = { en, bg };

  private static readonly LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
    ar: () => import('@/i18n/ar.json'),
    cs: () => import('@/i18n/cs.json'),
    da: () => import('@/i18n/da.json'),
    de: () => import('@/i18n/de.json'),
    el: () => import('@/i18n/el.json'),
    es: () => import('@/i18n/es.json'),
    et: () => import('@/i18n/et.json'),
    fi: () => import('@/i18n/fi.json'),
    fil: () => import('@/i18n/fil.json'),
    fr: () => import('@/i18n/fr.json'),
    ga: () => import('@/i18n/ga.json'),
    he: () => import('@/i18n/he.json'),
    hi: () => import('@/i18n/hi.json'),
    hr: () => import('@/i18n/hr.json'),
    hu: () => import('@/i18n/hu.json'),
    id: () => import('@/i18n/id.json'),
    it: () => import('@/i18n/it.json'),
    ja: () => import('@/i18n/ja.json'),
    ko: () => import('@/i18n/ko.json'),
    lt: () => import('@/i18n/lt.json'),
    lv: () => import('@/i18n/lv.json'),
    mk: () => import('@/i18n/mk.json'),
    ms: () => import('@/i18n/ms.json'),
    mt: () => import('@/i18n/mt.json'),
    nb: () => import('@/i18n/nb.json'),
    nl: () => import('@/i18n/nl.json'),
    pl: () => import('@/i18n/pl.json'),
    pt: () => import('@/i18n/pt.json'),
    ro: () => import('@/i18n/ro.json'),
    ru: () => import('@/i18n/ru.json'),
    sk: () => import('@/i18n/sk.json'),
    sl: () => import('@/i18n/sl.json'),
    sq: () => import('@/i18n/sq.json'),
    sr: () => import('@/i18n/sr.json'),
    sv: () => import('@/i18n/sv.json'),
    th: () => import('@/i18n/th.json'),
    tr: () => import('@/i18n/tr.json'),
    uk: () => import('@/i18n/uk.json'),
    vi: () => import('@/i18n/vi.json'),
    zh: () => import('@/i18n/zh.json'),
    'zh-hant': () => import('@/i18n/zh-hant.json'),
  };

  private static readonly loaded: Record<string, unknown> = { ...AdminDictionary.BUNDLED };

  /** The fallback is English because that is the dictionary every key is authored in. */
  static readonly FALLBACK_LOCALE = 'en';

  static get locales(): string[] {
    return [...Object.keys(AdminDictionary.BUNDLED), ...Object.keys(AdminDictionary.LOADERS)];
  }

  static has(locale: string): boolean {
    return AdminDictionary.locales.includes(AdminDictionary.normalize(locale));
  }

  /** Whether the language's words are here to read synchronously — always for the bundled ones. */
  static isLoaded(locale: string): boolean {
    return Object.prototype.hasOwnProperty.call(AdminDictionary.loaded, AdminDictionary.normalize(locale));
  }

  /**
   * Fetches a language's words once. A language the console does not ship resolves at once and its
   * readers see English; a failed fetch rejects, so the caller keeps the language it already shows.
   */
  static async load(locale: string): Promise<void> {
    const code = AdminDictionary.normalize(locale);
    const loader = AdminDictionary.LOADERS[code];
    if (!loader || AdminDictionary.isLoaded(code)) return;
    AdminDictionary.loaded[code] = (await loader()).default;
  }

  /** `rtl` for a language written right to left, which the console then lays out mirrored. */
  static direction(locale: string): TextDirection {
    return LocalizationUtils.textDirection(AdminDictionary.normalize(locale));
  }

  /**
   * The language's name IN that language, which is what a chooser must show: someone who only reads
   * Bulgarian needs to find "Български", not "Bulgarian". `Intl.DisplayNames` owns those names; the
   * tag itself is the answer when a runtime cannot name it. Capitalised in that language's own terms,
   * because a chooser lists names and many languages write their own name lower-case in a sentence.
   */
  static label(locale: string): string {
    const normalized = AdminDictionary.normalize(locale);
    try {
      const name = new Intl.DisplayNames([normalized], { type: 'language' }).of(normalized) || normalized;
      return name.charAt(0).toLocaleUpperCase(normalized) + name.slice(1);
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

  /**
   * A non-string entry (a table such as `slug.transliteration`) for this locale, or null when the
   * language ships none. No English fallback: a table belongs to one language's script.
   */
  static section(locale: string, key: string): Record<string, unknown> | null {
    const value = AdminDictionary.walk(AdminDictionary.normalize(locale), key);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }

  private static read(locale: string, key: string): string {
    const value = AdminDictionary.walk(locale, key);
    return typeof value === 'string' ? value : '';
  }

  private static walk(locale: string, key: string): unknown {
    let cursor: unknown = AdminDictionary.loaded[locale];
    for (const segment of key.split('.')) {
      if (!cursor || typeof cursor !== 'object') return undefined;
      cursor = (cursor as Record<string, unknown>)[segment];
    }
    return cursor;
  }

  /** The key a dictionary is filed under: `bg-BG` → `bg`, `zh-TW` → `zh-hant`. */
  private static normalize(locale: string): string {
    return LocalizationUtils.normalizeLocaleCode(locale, { short: true });
  }
}
