import { TimezoneUtils } from '@/lib/timezone';

export class DateTimePickerConstants {
  /**
   * The twelve month names in the console's language, from `Intl` — no dictionary has to spell them.
   * Capitalised because they label buttons and headings (Bulgarian writes them in lower case in a sentence).
   */
  static monthLabels(): string[] {
    const format = new Intl.DateTimeFormat(TimezoneUtils.resolveSystemLocale(), { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, month) => {
      const name = format.format(new Date(Date.UTC(2000, month, 1)));
      return name.charAt(0).toLocaleUpperCase() + name.slice(1);
    });
  }

  /** A calendar's weekday column heading in the console's language. */
  static weekdayLabel(date: Date): string {
    return new Intl.DateTimeFormat(TimezoneUtils.resolveSystemLocale(), { weekday: 'short' }).format(date);
  }
}
