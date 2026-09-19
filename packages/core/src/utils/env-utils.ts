import { CoercionUtils } from '@core/utils/coercion-utils';

/**
 * Environment-variable helpers. Centralizes reading process.env so feature flags aren't parsed with
 * ad-hoc `String(process.env.X || '').trim().toLowerCase() === 'true'` snippets scattered everywhere.
 *
 * @example EnvUtils.flag('ENFORCE_AUTHZ_GATEWAY')          // true when set to '1' | 'true' | 'yes' | 'on'
 * @example EnvUtils.flag('ENFORCE_AUTHZ_GATEWAY', true)    // defaults to true when unset
 */
export class EnvUtils {
  /** The product's variable prefix, and the company-named one it replaced. */
  private static readonly PREFIX = 'ATLANTIS_';
  private static readonly LEGACY_PREFIX = 'FROMCODE_';

  /** Legacy names already warned about, so a variable read in a loop warns once, not every call. */
  private static readonly warned = new Set<string>();

  /**
   * The raw value for `name`, accepting the legacy `FROMCODE_*` spelling of the same variable.
   *
   * The binaries and the product are called Atlantis; the variables were still named after the
   * company. Renaming them outright is the one change here that could not be made by editing the
   * repository: these are set in deployed `.env` files, in Dockerfiles, and — for the three the MCP
   * guide documents — in other people's Claude configuration, none of which this repository can
   * reach. A rename with no fallback would read as "unset" and fail at boot with a message about a
   * variable the operator believes they have set.
   *
   * So both spellings resolve, the new one wins, and using the old one says so on stderr once. The
   * legacy branch is deletable in a later release, at which point the warning is the notice that it
   * is about to be.
   */
  private static raw(name: string): string | undefined {
    const direct = process.env[name];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;
    if (!name.startsWith(EnvUtils.PREFIX)) return direct;

    const legacyName = `${EnvUtils.LEGACY_PREFIX}${name.slice(EnvUtils.PREFIX.length)}`;
    const legacy = process.env[legacyName];
    if (legacy === undefined || legacy === null || String(legacy).trim() === '') return direct;

    if (!EnvUtils.warned.has(legacyName)) {
      EnvUtils.warned.add(legacyName);
      console.warn(`[atlantis] ${legacyName} is deprecated — rename it to ${name}. Both work for now.`);
    }
    return legacy;
  }

  /** Read a boolean feature flag from the environment. Unset ⇒ `fallback` (default false). */
  static flag(name: string, fallback = false): boolean {
    const raw = EnvUtils.raw(name);
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
    const raw = EnvUtils.raw(name);
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    const parsed = Number(String(raw).trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * Read a string setting from the environment, trimmed. Unset or blank ⇒ `fallback` (default `''`).
   * Centralizes string env parsing the same way `flag()` centralizes booleans.
   *
   * @example EnvUtils.text('THEMES_DIR')
   */
  static text(name: string, fallback = ''): string {
    const raw = EnvUtils.raw(name);
    if (raw === undefined || raw === null) return fallback;
    const trimmed = String(raw).trim();
    return trimmed || fallback;
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

  /**
   * True when running in a browser (a live DOM is present). Use this instead of inline
   * `typeof window === 'undefined'` / `typeof document === 'undefined'` guards in server/isomorphic
   * framework code. (Client React packages use reactor's `Platform.isBrowser` — same check, no core dep.)
   */
  static isBrowser(): boolean {
    return typeof document !== 'undefined';
  }

  /** True when running server-side / in Node (no DOM). The inverse of {@link isBrowser}. */
  static isServer(): boolean {
    return typeof document === 'undefined';
  }
}
