/**
 * General type and runtime utilities.
 *
 * @example
 * TypeUtils.isObject(value)
 * TypeUtils.isPlainObject(value)
 * await TypeUtils.sleep(100)
 * TypeUtils.normalizeString(value)
 * TypeUtils.parseBoolean(value)
 */
export class TypeUtils {
  static isObject(value: unknown): boolean {
    return value !== null && typeof value === 'object';
  }

  static isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static normalizeString(value: unknown): string {
    return String(value || '').trim();
  }

  static parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return ['true', 'yes', '1', 'on'].includes(lower);
    }
    return false;
  }
}
