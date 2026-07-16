import { CoercionUtils } from '../coercion-utils';

/**
 * Environment-variable helpers. Centralizes reading process.env so feature flags aren't parsed with
 * ad-hoc `String(process.env.X || '').trim().toLowerCase() === 'true'` snippets scattered everywhere.
 *
 * @example EnvUtils.flag('ENFORCE_AUTHZ_GATEWAY')          // true when set to '1' | 'true' | 'yes' | 'on'
 * @example EnvUtils.flag('ENFORCE_AUTHZ_GATEWAY', true)    // defaults to true when unset
 */
export class EnvUtils {
  /** Read a boolean feature flag from the environment. Unset ⇒ `fallback` (default false). */
  static flag(name: string, fallback = false): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    return CoercionUtils.toBoolean(raw, fallback) === true;
  }

  /**
   * Read a numeric setting from the environment. Unset, blank, or non-numeric ⇒ `fallback`.
   * Centralizes numeric env parsing the same way `flag()` centralizes booleans.
   *
   * @example EnvUtils.number('RESOLVE_CACHE_TTL_MS', 30000)
   */
  static number(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    const parsed = Number(String(raw).trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * True when running in a production deployment (`NODE_ENV=production`). Use this instead of raw
   * `process.env.NODE_ENV` comparisons — e.g. to decide whether cookies should be `secure`.
   */
  static isProduction(): boolean {
    return String(process.env.NODE_ENV).trim().toLowerCase() === 'production';
  }

  /**
   * True when running in a development deployment (`NODE_ENV=development`). Use this instead of raw
   * `process.env.NODE_ENV` comparisons — e.g. to decide whether to emit verbose debug logging.
   */
  static isDevelopment(): boolean {
    return String(process.env.NODE_ENV).trim().toLowerCase() === 'development';
  }
}
