/**
 * Formatting utilities for display.
 *
 * @example
 * FormatUtils.formatDate(new Date())       // "1/15/2024, 10:30:00 AM"
 * FormatUtils.formatMoney(99.99, 'EUR')    // "€99.99"  (currency is required — never invented)
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
   * Format a monetary value with a currency symbol using Intl.NumberFormat.
   *
   * The CALLER owns the currency — this helper never invents one. It used to default the parameter to
   * `'USD'`, so a store configured in EUR whose row happened to carry no currency silently rendered
   * dollars; a made-up currency is indistinguishable from a real one downstream. `currency` is now
   * required, and a blank/unknown code renders the plain amount with NO currency rather than a
   * fabricated symbol.
   *
   * (Money formatting is a Finance-plugin concern and does not belong in the domain-agnostic
   * framework at all — but this is exported through the SDK and called by the ecommerce, finance and
   * lms plugins, so it cannot simply be deleted. Migrating those call sites onto a Finance-owned
   * formatter is the real fix.)
   *
   * @param value    - Amount (coerced to number; non-finite values render as 0)
   * @param currency - ISO 4217 currency code. Blank renders the amount without a currency.
   */
  static formatMoney(value: unknown, currency: string): string {
    const amount = Number(value || 0);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const code = String(currency || '').trim().toUpperCase();
    if (!code) {
      return safeAmount.toFixed(2);
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safeAmount);
    } catch {
      return `${code} ${safeAmount.toFixed(2)}`;
    }
  }
}