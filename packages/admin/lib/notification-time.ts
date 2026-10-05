import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * When a notification happened, as a person reads it: "5 minutes ago" while it is recent, a date once
 * it is not. The exact moment is always available as `absolute`, for the tooltip and the detail line.
 *
 * The words come from the browser's own `Intl` in the console's language, so no unit name is spelled
 * out here.
 */
export class NotificationTime {
  private static readonly UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
  ];
  /** Past this age the date reads better than "9 days ago". */
  private static readonly RELATIVE_LIMIT_SECONDS = 7 * 86400;
  /** Under this it is simply "now". */
  private static readonly NOW_SECONDS = 45;

  static relative(value: unknown, now: number = Date.now()): string {
    const date = NotificationTime.parse(value);
    if (!date) return '';
    const seconds = Math.round((now - date.getTime()) / 1000);
    if (seconds >= NotificationTime.RELATIVE_LIMIT_SECONDS) {
      return date.toLocaleDateString(AdminI18n.locale, { day: 'numeric', month: 'short', year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
    }
    const format = new Intl.RelativeTimeFormat(AdminI18n.locale, { numeric: 'auto' });
    if (seconds < NotificationTime.NOW_SECONDS) return format.format(0, 'second');
    const [unit, size] = [...NotificationTime.UNITS].reverse().find(([, span]) => seconds >= span) ?? NotificationTime.UNITS[0];
    return format.format(-Math.floor(seconds / size), unit);
  }

  static absolute(value: unknown): string {
    const date = NotificationTime.parse(value);
    return date ? date.toLocaleString(AdminI18n.locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }

  private static parse(value: unknown): Date | null {
    const date = new Date(String(value ?? ''));
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
