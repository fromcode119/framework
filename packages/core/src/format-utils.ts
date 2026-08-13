/**
 * Formatting utilities for display.
 *
 * DOMAIN-AGNOSTIC ONLY. This carried a `formatMoney` helper that rendered currency with
 * `Intl.NumberFormat` — a business concern the framework has no basis to decide. It could not know which
 * currencies the operator had configured, what symbol each one used, which side that symbol sat on, or
 * how many decimals it took, so it guessed: symbol before the amount, always two decimals. A shop that
 * had configured its currency to render `1 316,22 €` got `€1,316.22`, and a zero-decimal currency got
 * two. The plugin that owns the domain owns the formatting; nothing about money belongs here.
 *
 * @example
 * FormatUtils.formatDate(new Date())       // "1/15/2024, 10:30:00 AM"
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
}
