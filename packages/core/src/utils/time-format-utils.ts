import { TimeFormat } from '@core/enums/time-format.enum';

/**
 * The hour cycle a site's times are written in.
 *
 * `locale` follows the site's language — Bulgarian, German and most of Europe write 24-hour times,
 * US English writes 12-hour — so a Bulgarian shop reads 16:02 even while its admin UI is in English.
 * `h12` / `h24` force one clock regardless of language.
 */
export class TimeFormatUtils {
  /** `h12` or `h23` for `Intl.DateTimeFormat`'s `hourCycle`. */
  static hourCycle(format: unknown, siteLocale: string): Intl.DateTimeFormatOptions['hourCycle'] {
    const resolved = TimeFormat.resolve(format);
    if (resolved === TimeFormat.H12) return 'h12';
    if (resolved === TimeFormat.H24) return 'h23';
    return TimeFormatUtils.languageUses12Hour(siteLocale) ? 'h12' : 'h23';
  }

  /** Whether the language writes 12-hour times. Unknown or blank reads as 24-hour, the ISO clock. */
  static languageUses12Hour(siteLocale: string): boolean {
    const locale = String(siteLocale || '').trim();
    if (!locale) return false;
    try {
      const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
      return cycle === 'h11' || cycle === 'h12';
    } catch {
      return false;
    }
  }
}
