import { CoercionUtils, EnvUtils, NetworkAddressUtils, SystemConstants } from '@fromcode119/core';

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
 * The DEFAULT_* values mirror the seeds written by `ServerSettingsService.ensureDefaultSettings()`,
 * which imports them from here so the number exists in exactly one place.
 */
export class RateLimitSettingsUtils {
  /** Requests per window for ANONYMOUS traffic (bucketed per IP). */
  static readonly DEFAULT_MAX_REQUESTS = '100';
  /** Requests per window for TOKEN-BEARING traffic (bucketed per IP + token). */
  static readonly DEFAULT_MAX_REQUESTS_AUTHENTICATED = '5000';
  /** Requests per window for INTERNAL server-to-server traffic (bucketed per calling service address). */
  static readonly DEFAULT_MAX_REQUESTS_INTERNAL = '20000';
  /** Addresses internal services call from — loopback + RFC1918, the ranges a container network uses. */
  static readonly DEFAULT_INTERNAL_CLIENTS = NetworkAddressUtils.PRIVATE_RANGES_TEXT;
  /** Length of the counting window, in milliseconds. */
  static readonly DEFAULT_WINDOW_MS = '900000';

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
