import { StringUtils } from '@fromcode119/core/client';
import { AdminDictionary } from '@/lib/i18n/admin-dictionary';

/**
 * A record's slug from its title, in the title's own language.
 *
 * `StringUtils.slugify` keeps Latin letters only, so every Cyrillic title used to come out as the
 * fallback `item`. A language that writes in another script ships its transliteration as data in its
 * admin dictionary (`slug.transliteration`, plus `slug.wordEndings` for endings its rules spell
 * differently); nothing here knows any one language. A title in a script with no table gives no slug
 * at all, so the required field asks the operator instead of inventing one.
 */
export class AdminSlug {
  static fromTitle(title: string, locale: string): string {
    return StringUtils.slugify(AdminSlug.transliterate(String(title || ''), locale), '');
  }

  static transliterate(text: string, locale: string): string {
    const source = AdminSlug.tableLocale(text, locale);
    if (!source) return text;
    const letters = AdminDictionary.section(source, 'slug.transliteration') || {};
    const endings = AdminDictionary.section(source, 'slug.wordEndings') || {};
    return text.replace(/[\p{L}\p{M}]+/gu, (word) => AdminSlug.word(word, letters, endings));
  }

  /**
   * The language whose table spells this title: the record's own, else the first shipped language whose
   * table knows the title's first non-Latin letter — the editing locale can fall back to the browser's,
   * which says nothing about the script the operator typed in.
   */
  private static tableLocale(text: string, locale: string): string {
    if (AdminDictionary.section(locale, 'slug.transliteration')) return locale;
    const letter = Array.from(text.toLowerCase()).find((char) => /\p{L}/u.test(char) && !/[a-z]/.test(char));
    if (!letter) return '';
    return AdminDictionary.locales.find((candidate) => {
      const table = AdminDictionary.section(candidate, 'slug.transliteration');
      return Boolean(table && typeof table[letter] === 'string');
    }) || '';
  }

  private static word(word: string, letters: Record<string, unknown>, endings: Record<string, unknown>): string {
    const lower = word.toLowerCase();
    const ending = Object.keys(endings).find((suffix) => lower.length > suffix.length && lower.endsWith(suffix));
    const stem = ending ? lower.slice(0, -ending.length) : lower;
    const latin = Array.from(stem).map((char) => (typeof letters[char] === 'string' ? letters[char] as string : char)).join('');
    return ending ? latin + String(endings[ending]) : latin;
  }
}
