import { RateLimiter } from '@core/security/rate-limiter';

/**
 * How many database calls one plugin may make for one site per minute.
 *
 * The limit is the operator's (admin Settings -> Security, `plugin_db_calls_per_minute`); the API hands
 * its settings reader in with {@link useLimit}. 0 means unlimited.
 *
 * It replaces a hardcoded 5000 per minute per plugin that counted EVERY site together: past about 83
 * calls a second — a few dozen storefront requests — every request to that plugin failed until the
 * minute rolled over, on every site at once, with no control anywhere that showed or moved the number.
 */
export class PluginDatabaseQuota {
  private static readonly WINDOW_MS = 60_000;
  private static readonly limiter = new RateLimiter(0, PluginDatabaseQuota.WINDOW_MS);
  private static limit: () => number = () => 0;

  static useLimit(resolver: () => number): void {
    PluginDatabaseQuota.limit = resolver;
  }

  /** False when this plugin has used its calls for this site this minute. */
  static allow(pluginSlug: string, tenantId: string | undefined): boolean {
    const limit = PluginDatabaseQuota.limit();
    if (!(limit > 0)) return true;
    return PluginDatabaseQuota.limiter.check(`${pluginSlug}\u0000${tenantId ?? ''}`, limit);
  }
}
