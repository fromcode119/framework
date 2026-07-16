import { cache } from 'react';
import { ServerApiUtils } from './server-api';

/**
 * Per-request memoized `/system/frontend` payload (React `cache()`).
 *
 * One SSR page render previously fetched this identical, user-independent payload
 * up to 4 times (ThemeAssets, PluginInjectionRenderer head + bodyStart,
 * FrontendPublicSettings). React `cache()` dedupes all callers within a single
 * request render; nothing persists across requests, so the underlying fetch keeps
 * its `no-store` semantics (see storefront-performance-audit.md §1.2 / Phase 1.2).
 *
 * Prefers the internal API base (server-to-server) and falls back to the public
 * resolution path — the same strategy FrontendPublicSettings already used.
 */
export class FrontendConfigCache {
  private static readonly configCache = cache(async (): Promise<Record<string, unknown> | null> => {
    const internalResponse = await ServerApiUtils.serverFetchInternalResponse(ServerApiUtils.buildSystemFrontendPath());
    if (internalResponse?.ok) {
      return await internalResponse.json() as Record<string, unknown>;
    }
    return await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemFrontendPath()) as Record<string, unknown> | null;
  });

  static async read(): Promise<Record<string, unknown> | null> {
    return FrontendConfigCache.configCache();
  }
}
