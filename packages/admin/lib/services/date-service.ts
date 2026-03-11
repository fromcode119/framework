import { BaseService } from './base-service';

/**
 * Service for date manipulation and relative formatting utilities.
 *
 * @example
 * ```typescript
 * const services = AdminServices.getInstance();
 * const d       = services.date.parseDate('2024-01-15');     // Date | null
 * const future  = services.date.addDays(new Date(), 7);      // 7 days from now
 * const rel     = services.date.formatRelative(new Date());  // 'Just now'
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
   * Returns a human-readable relative time string (e.g. '2 hours ago').
   */
  formatRelative(value: unknown): string {
    const date = this.parseDate(value);
    if (!date) return '-';
    const diff = Date.now() - date.getTime();
    const abs = Math.abs(diff);
    const future = diff < 0;
    const label = (n: number, unit: string) => `${n} ${unit}${n !== 1 ? 's' : ''} ${future ? 'from now' : 'ago'}`;
    if (abs < 60_000) return 'Just now';
    if (abs < 3_600_000) return label(Math.floor(abs / 60_000), 'minute');
    if (abs < 86_400_000) return label(Math.floor(abs / 3_600_000), 'hour');
    if (abs < 2_592_000_000) return label(Math.floor(abs / 86_400_000), 'day');
    if (abs < 31_536_000_000) return label(Math.floor(abs / 2_592_000_000), 'month');
    return label(Math.floor(abs / 31_536_000_000), 'year');
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