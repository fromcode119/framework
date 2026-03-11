/**
 * Type coercion utilities. Safe conversions with explicit fallbacks.
 *
 * @example
 * CoercionUtils.toString(value)
 * CoercionUtils.toNumber(value, 0)
 * CoercionUtils.toBoolean(value)
 * CoercionUtils.toSafeIsoDate(date)
 */
export class CoercionUtils {
  static toString(value: unknown): string {
    return String(value ?? '').trim();
  }

  static toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static toBoolean(value: unknown, fallback: boolean | undefined = false): boolean | undefined {
    if (typeof value === 'boolean') return value;
    const normalized = CoercionUtils.toString(value).toLowerCase();
    if (['true', '1', 'yes', 'on', 'enabled', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'disabled', 'inactive'].includes(normalized)) return false;
    return fallback;
  }

  static toIsoDateOrNow(value: unknown): string {
    if (!value) return new Date().toISOString();
    try {
      const parsed = new Date(value as any);
      if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
      return parsed.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  static toIsoDateOrNull(value: unknown): string | null {
    const raw = CoercionUtils.toString(value);
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  /**
   * Converts a Date object to a safe ISO 8601 string in UTC timezone.
   * Returns null for invalid dates, null, undefined, or NaN timestamps.
   */
  static toSafeIsoDate(value: Date | null | undefined): string | null {
    if (!value) return null;
    const time = value?.getTime?.();
    if (!Number.isFinite(Number(time))) return null;
    const date = new Date(Number(time));
    const pad = (num: number, size = 2) => String(num).padStart(size, '0');
    return [
      `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
      `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}Z`,
    ].join('T');
  }

  /** Coerce to plain object. Returns {} if not an object. */
  static toObject<T extends Record<string, unknown> = Record<string, unknown>>(value: unknown): T {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
    return {} as T;
  }

  /** Coerce to array. Returns [] if not an array. */
  static toArray<T = unknown>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }
}