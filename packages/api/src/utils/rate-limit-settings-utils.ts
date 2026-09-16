import { CoercionUtils, EnvUtils, NetworkAddressUtils, SystemConstants, SystemSettingRegistry } from '@fromcode119/core';

/**
 * Single resolution point for the rate-limit budgets.
 *
 * Precedence is always: the OPERATOR's saved setting (admin Settings → Security, cached in the API's
 * settings map) → the deployment env var → the seeded default. Nothing else may override it. Three
 * call sites used to short-circuit with `if (process.env.NODE_ENV === 'development') return 10000`,
 * which silently discarded whatever the operator had configured — a value on the running platform that
 * no admin control produced. If a relaxed development budget is wanted, the operator raises the
 * declared setting; there is no hidden branch.
 *
 * The DEFAULT_* values are READ FROM THE DECLARATION — `SystemSettingRegistry`, where each of these
 * settings states its own seeded default beside its scope. They used to be literals here that the
 * seed imported; now the seed and this resolver read the same declaration, so the number exists in
 * exactly one place whichever end you come from.
 */
export class RateLimitSettingsUtils {
  /** Requests per window for ANONYMOUS traffic (bucketed per IP). */
  static readonly DEFAULT_MAX_REQUESTS = SystemSettingRegistry.defaultValueOf(SystemConstants.META_KEY.RATE_LIMIT_MAX);
  /** Requests per window for TOKEN-BEARING traffic (bucketed per IP + token). */
  static readonly DEFAULT_MAX_REQUESTS_AUTHENTICATED = SystemSettingRegistry.defaultValueOf(SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED);
  /** Requests per window for INTERNAL server-to-server traffic (bucketed per calling service address). */
  static readonly DEFAULT_MAX_REQUESTS_INTERNAL = SystemSettingRegistry.defaultValueOf(SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL);
  /** Addresses internal services call from — loopback + RFC1918, the ranges a container network uses. */
  static readonly DEFAULT_INTERNAL_CLIENTS = SystemSettingRegistry.defaultValueOf(SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS);
  /** Every registered edge provider's published ranges, JSON keyed by provider key — see `resolveNetworkEdgeRanges`. */
  static readonly DEFAULT_EDGE_PROVIDER_RANGES = SystemSettingRegistry.defaultValueOf(SystemConstants.META_KEY.RATE_LIMIT_EDGE_PROVIDER_RANGES);
  /** Length of the counting window, in milliseconds. */
  static readonly DEFAULT_WINDOW_MS = SystemSettingRegistry.defaultValueOf(SystemConstants.META_KEY.RATE_LIMIT_WINDOW);

  private static readonly ENV_MAX_REQUESTS = 'RATE_LIMIT_MAX';
  private static readonly ENV_MAX_REQUESTS_AUTHENTICATED = 'RATE_LIMIT_MAX_AUTHENTICATED';
  private static readonly ENV_MAX_REQUESTS_INTERNAL = 'RATE_LIMIT_MAX_INTERNAL';
  private static readonly ENV_INTERNAL_CLIENTS = 'RATE_LIMIT_INTERNAL_CLIENTS';
  private static readonly ENV_WINDOW_MS = 'RATE_LIMIT_WINDOW_MS';

  /** The configured counting window in ms. */
  static resolveWindowMs(settingsCache?: Map<string, string>): number {
    return RateLimitSettingsUtils.resolve(
      SystemConstants.META_KEY.RATE_LIMIT_WINDOW,
      RateLimitSettingsUtils.ENV_WINDOW_MS,
      RateLimitSettingsUtils.DEFAULT_WINDOW_MS,
      settingsCache,
    );
  }

  /** The configured request budget for this request's bucket. */
  static resolveMaxRequests(isAuthenticated: boolean, settingsCache?: Map<string, string>): number {
    return isAuthenticated
      ? RateLimitSettingsUtils.resolve(
        SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED,
        RateLimitSettingsUtils.ENV_MAX_REQUESTS_AUTHENTICATED,
        RateLimitSettingsUtils.DEFAULT_MAX_REQUESTS_AUTHENTICATED,
        settingsCache,
      )
      : RateLimitSettingsUtils.resolve(
        SystemConstants.META_KEY.RATE_LIMIT_MAX,
        RateLimitSettingsUtils.ENV_MAX_REQUESTS,
        RateLimitSettingsUtils.DEFAULT_MAX_REQUESTS,
        settingsCache,
      );
  }

  /** The configured request budget for an internal server-to-server caller. */
  static resolveMaxRequestsInternal(settingsCache?: Map<string, string>): number {
    return RateLimitSettingsUtils.resolve(
      SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL,
      RateLimitSettingsUtils.ENV_MAX_REQUESTS_INTERNAL,
      RateLimitSettingsUtils.DEFAULT_MAX_REQUESTS_INTERNAL,
      settingsCache,
    );
  }

  /**
   * The addresses/CIDR blocks the operator has declared as internal service callers.
   *
   * An operator who clears the setting means "nothing is internal" — that must survive, so a saved
   * BLANK value is not allowed to fall through to the env var or the seed. Only a key that was never
   * configured at all resolves down the chain.
   */
  static resolveInternalClients(settingsCache?: Map<string, string>): string[] {
    const stored = settingsCache?.get(SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS);
    const raw = stored === undefined
      ? (EnvUtils.text(RateLimitSettingsUtils.ENV_INTERNAL_CLIENTS) || RateLimitSettingsUtils.DEFAULT_INTERNAL_CLIENTS)
      : CoercionUtils.toString(stored);
    return NetworkAddressUtils.parseList(raw);
  }

  /**
   * Every registered edge provider's operator-declared extra ranges, ADDITIONAL to each provider's own
   * hardcoded default ranges — keyed by the provider's own `key`, the shape
   * `NetworkAddressUtils.resolveClientIp`/`matchEdgeProvider` expect. A saved blank value means "no
   * additions for any provider"; it does not, and cannot, shrink a provider's hardcoded baseline.
   *
   * ONE generic setting holds every provider's ranges as one JSON object (see
   * `SystemSettingRegistry.edgeProviderRangesDefault`), built and read by walking
   * `NetworkEdgeProviderRegistry.ALL` rather than naming a vendor — a second provider needs no new
   * settings key, env var, or case here.
   *
   * No env-var override for this setting: the old single-provider setting was one comma-separated CIDR
   * list, which an env var could reasonably hold, but this one is a JSON object across every registered
   * provider, which does not translate to a single flat env var. The DB-backed setting (editable without
   * a deploy) plus the code-level seed already cover "extend without a deploy" and "safe out of the box",
   * so the env-var layer is intentionally dropped here rather than carried forward as a mismatched shape.
   */
  static resolveNetworkEdgeRanges(settingsCache?: Map<string, string>): Readonly<Record<string, readonly string[]>> {
    const stored = settingsCache?.get(SystemConstants.META_KEY.RATE_LIMIT_EDGE_PROVIDER_RANGES);
    const raw = stored === undefined ? RateLimitSettingsUtils.DEFAULT_EDGE_PROVIDER_RANGES : CoercionUtils.toString(stored);
    return RateLimitSettingsUtils.parseEdgeProviderRanges(raw);
  }

  /** Safely parse the stored/default JSON blob into the provider-keyed ranges map. Malformed input matches nothing. */
  private static parseEdgeProviderRanges(raw: string): Readonly<Record<string, readonly string[]>> {
    if (!raw) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const result: Record<string, readonly string[]> = {};
    for (const [providerKey, value] of Object.entries(parsed as Record<string, unknown>)) {
      result[providerKey] = NetworkAddressUtils.parseList(value);
    }
    return result;
  }

  private static resolve(
    settingKey: string,
    envName: string,
    seededDefault: string,
    settingsCache?: Map<string, string>,
  ): number {
    const configured = CoercionUtils.toString(settingsCache?.get(settingKey));
    const raw = configured || EnvUtils.text(envName) || seededDefault;
    return Math.trunc(CoercionUtils.toNumber(raw, Number(seededDefault)));
  }
}
