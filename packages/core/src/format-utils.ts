/**
 * Formatting utilities for display.
 *
 * @example
 * FormatUtils.formatDate(new Date())       // "1/15/2024, 10:30:00 AM"
 * FormatUtils.formatMoney(99.99, 'EUR')    // "€99.99"
 */
export class FormatUtils {
  /**
   * Format a date value for display using the locale default.
   * Returns '-' for null, undefined, empty, or invalid dates.
   */
  static formatDate(value: unknown): string {
    if (!value) return '-';
    const date = new Date(value as any);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  /**
   * Format a monetary value with currency symbol using Intl.NumberFormat.
   * Falls back gracefully for invalid currency codes.
   *
   * @param value    - Amount (coerced to number; non-finite values render as 0)
   * @param currency - ISO 4217 currency code (default 'USD')
   */
  static formatMoney(value: unknown, currency = 'USD'): string {
    const amount = Number(value || 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: String(currency || 'USD').toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safeAmount);
    } catch {
      return `${currency} ${safeAmount.toFixed(2)}`;
    }
  }
}