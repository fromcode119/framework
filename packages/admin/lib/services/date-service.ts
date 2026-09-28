import { BaseService } from '@/lib/services/base-service';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Service for date manipulation and relative formatting utilities.
 *
 * @example
 * ```typescript
 * const services = AdminServices.getInstance();
 * const d       = services.date.parseDate('2024-01-15');     // Date | null
 * const future  = services.date.addDays(new Date(), 7);      // 7 days from now
 * const rel     = services.date.formatRelative(new Date());  // 'now'
 * const expired = services.date.isExpired('2023-01-01');     // true
 * ```
 */
export class DateService extends BaseService {
  /**
   * Parses a value into a Date. Returns null for invalid inputs.
   */
  parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Returns a new Date n days after the given date (negative n = before).
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Returns a human-readable relative time string in the console's language (e.g. '2 hours ago').
   */
  formatRelative(value: unknown): string {
    const date = this.parseDate(value);
    if (!date) return '-';
    const diff = date.getTime() - Date.now();
    const abs = Math.abs(diff);
    const sign = diff < 0 ? -1 : 1;
    const format = new Intl.RelativeTimeFormat(AdminI18n.locale, { numeric: 'auto' });
    if (abs < 60_000) return format.format(0, 'second');
    if (abs < 3_600_000) return format.format(sign * Math.floor(abs / 60_000), 'minute');
    if (abs < 86_400_000) return format.format(sign * Math.floor(abs / 3_600_000), 'hour');
    if (abs < 2_592_000_000) return format.format(sign * Math.floor(abs / 86_400_000), 'day');
    if (abs < 31_536_000_000) return format.format(sign * Math.floor(abs / 2_592_000_000), 'month');
    return format.format(sign * Math.floor(abs / 31_536_000_000), 'year');
  }

  /**
   * Returns true if the given date is in the past.
   */
  isExpired(value: unknown): boolean {
    const date = this.parseDate(value);
    if (!date) return false;
    return date.getTime() < Date.now();
  }

  /**
   * Returns true if the given date is within the next n days.
   */
  isExpiringSoon(value: unknown, withinDays = 7): boolean {
    const date = this.parseDate(value);
    if (!date) return false;
    const now = Date.now();
    const ts = date.getTime();
    return ts > now && ts < now + withinDays * 86_400_000;
  }
}