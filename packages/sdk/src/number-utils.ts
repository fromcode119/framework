/**
 * Number and numeric parsing utilities.
 *
 * @example
 * NumberUtils.parseLimit(req.query.limit, 50, 200) // clamped integer
 * NumberUtils.round2(3.14159)                       // 3.14
 */
export class NumberUtils {
  /**
   * Parse and clamp a limit/page-size value into a bounded integer.
   *
   * @example
   * NumberUtils.parseLimit(req.query.limit, 50, 200); // default 50, max 200
   */
  static parseLimit(value: unknown, fallback = 50, max = 200): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(max, parsed));
  }

  /**
   * Round to 2 decimal places (financial precision).
   * Returns 0 for non-finite inputs.
   */
  static round2(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  }
}