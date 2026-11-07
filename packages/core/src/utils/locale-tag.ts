/**
 * Reads a BCP 47 language tag the way translations are keyed: by language, and by script when the script
 * changes what a reader can read. `en-US` and `en` read the same text, so both key `en`; `zh-Hant` and
 * `zh-TW` are written in a different script from `zh`, so both key `zh-hant`.
 *
 * What counts as a language, and which script a region writes in, comes from the runtime's own locale
 * data (`Intl`), never from a list kept here:
 * - a two-letter language is always one;
 * - a three-letter language is one only when it has no two-letter code and the locale data names it
 *   (`fil`, `haw`, `yue`) — `eng` is `en`, and `max` or `faq` are not languages at all, so a settings
 *   object with such keys is never mistaken for translations;
 * - the script is kept only when it differs from the language's usual one (`sr-Latn`, `zh-Hant`), and a
 *   region that implies another script brings it (`zh-TW` → `zh-hant`).
 *
 * A runtime without that locale data (some phone engines) still reads two-letter languages and written
 * scripts; it only stops recognising three-letter languages and region-implied scripts.
 */
import { TextDirection } from '@core/enums/text-direction.enum';

export class LocaleTag {
  private static readonly SHAPE = /^([a-z]{2,3})((?:-[a-z0-9]{1,8})*)$/;
  private static readonly SCRIPT = /^[a-z]{4}$/;
  /** The ISO 15924 scripts Unicode writes right to left (Bidi_Class R/AL), lower-cased. */
  private static readonly RTL_SCRIPTS = new Set([
    'adlm', 'arab', 'hebr', 'mand', 'mend', 'nkoo', 'rohg', 'samr', 'syrc', 'thaa', 'yezi',
  ]);
  /** Longer than any real tag (BCP 47 practice keeps them within 35); a request can carry anything. */
  private static readonly MAX_LENGTH = 35;
  /** The caches are filled from request input, so each is emptied once it holds this many. */
  private static readonly MAX_CACHED = 500;
  private static readonly cache = new Map<string, string>();
  private static readonly languages = new Map<string, boolean>();
  private static names: Intl.DisplayNames | null | undefined;

  /** The tag lower-cased with `-` separators, or '' when its language is not one. */
  static full(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase().replace(/_/g, '-');
    if (raw.length > LocaleTag.MAX_LENGTH) return '';
    const match = LocaleTag.SHAPE.exec(raw);
    if (!match || !LocaleTag.isLanguage(match[1])) return '';
    return raw;
  }

  /** The key translations are stored under: the language, plus the script when it is not the usual one. */
  static key(value: unknown): string {
    const tag = LocaleTag.full(value);
    if (!tag) return '';
    const cached = LocaleTag.cache.get(tag);
    if (cached !== undefined) return cached;
    const language = LocaleTag.language(tag);
    const script = LocaleTag.script(tag);
    const key = script && script !== LocaleTag.script(language) ? `${language}-${script}` : language;
    LocaleTag.remember(LocaleTag.cache, tag, key);
    return key;
  }

  /**
   * Which way the tag's text runs: `rtl` when its script is written right to left (`ar`, `he`, `fa`,
   * `ur`, `az-Arab`), else `ltr`. The script is the one the tag names or the one the locale data implies
   * for its language and region; the right-to-left scripts are Unicode's (`RTL_SCRIPTS`).
   */
  static direction(value: unknown): TextDirection {
    const tag = LocaleTag.full(value);
    if (!tag) return TextDirection.LTR;
    return LocaleTag.RTL_SCRIPTS.has(LocaleTag.script(tag)) ? TextDirection.RTL : TextDirection.LTR;
  }

  /** The language alone: `zh-hant` → `zh`. */
  static language(tag: string): string {
    return String(tag).split('-')[0];
  }

  private static isLanguage(code: string): boolean {
    if (code.length === 2) return true;
    const known = LocaleTag.languages.get(code);
    if (known !== undefined) return known;
    const found = LocaleTag.isThreeLetterLanguage(code);
    LocaleTag.remember(LocaleTag.languages, code, found);
    return found;
  }

  private static isThreeLetterLanguage(code: string): boolean {
    const names = LocaleTag.displayNames();
    if (!names) return false;
    try {
      // A code with a two-letter twin (`eng`, `bul`) canonicalises to it; that twin is the key to use.
      if (Intl.getCanonicalLocales(code)[0] !== code) return false;
      return Boolean(names.of(code));
    } catch {
      return false;
    }
  }

  /** The script the tag is written in: the one it names, else the one its language and region imply. */
  private static script(tag: string): string {
    const named = tag.split('-').slice(1).find((part) => LocaleTag.SCRIPT.test(part));
    if (named) return named;
    try {
      return String(new Intl.Locale(tag).maximize().script ?? '').toLowerCase();
    } catch {
      return '';
    }
  }

  private static remember<T>(cache: Map<string, T>, key: string, value: T): void {
    if (cache.size >= LocaleTag.MAX_CACHED) cache.clear();
    cache.set(key, value);
  }

  private static displayNames(): Intl.DisplayNames | null {
    if (LocaleTag.names !== undefined) return LocaleTag.names;
    try {
      LocaleTag.names = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
    } catch {
      LocaleTag.names = null;
    }
    return LocaleTag.names;
  }
}
