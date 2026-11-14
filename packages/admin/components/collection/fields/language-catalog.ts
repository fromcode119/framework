import { ISystemLocaleOption } from '@/components/collection/fields/interfaces/system-locale-option.interface';
import { TimezoneUtils } from '@/lib/timezone';

/**
 * The ISO 639-1 languages, for a control that means "which language" when the answer is not limited to
 * the languages a site already runs (adding one to Settings → Localization is exactly that case). Like
 * {@link CountryCatalog}, the CODES are the standard and the NAMES come from `Intl.DisplayNames` in the
 * console's language, so a Bulgarian console lists "немски", not "German".
 */
export class LanguageCatalog {
  static readonly CODES: readonly string[] = [
    'aa', 'ab', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az', 'ba', 'be', 'bg', 'bi', 'bm',
    'bn', 'bo', 'br', 'bs', 'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy', 'da', 'de', 'dv',
    'dz', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy', 'ga',
    'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz', 'ia', 'id',
    'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk', 'kl',
    'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt',
    'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'na', 'nb', 'nd', 'ne',
    'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny', 'oc', 'oj', 'om', 'or', 'os', 'pa', 'pi', 'pl', 'ps',
    'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm',
    'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl',
    'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'wo',
    'xh', 'yi', 'yo', 'za', 'zh', 'zu',
  ];

  /**
   * Every language as an option — "немски (de)" — named and sorted in the console's language. A code
   * already in use that is not a bare ISO 639-1 one (`zh-hant`, `pt-BR`) is kept as an option of its
   * own, so a saved value is never shown as empty.
   */
  static options(current: readonly string[] = []): ISystemLocaleOption[] {
    const locale = TimezoneUtils.resolveSystemLocale();
    const codes = [...LanguageCatalog.CODES, ...current.filter((code) => code && !LanguageCatalog.CODES.includes(code))];
    return codes
      .map((code) => ({ value: code, label: `${LanguageCatalog.nameOf(code, locale)} (${code})` }))
      .sort((left, right) => left.label.localeCompare(right.label, locale));
  }

  /** The language's name in that language itself — "Deutsch" for `de` — or '' when unknown. */
  static ownName(code: string): string {
    const name = LanguageCatalog.nameOf(code, code);
    if (!name || name === code) return '';
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  }

  private static nameOf(code: string, locale: string): string {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(code) || code;
    } catch {
      return code;
    }
  }
}
