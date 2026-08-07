import { cache } from 'react';

import { ServerApiUtils } from '@/lib/server-api';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

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
  private static readonly configCache = cache(async (): Promise<ServerFetchOutcome<Record<string, unknown>>> => {
    const internalOutcome = await ServerApiUtils.serverFetchInternalResponseOutcome(ServerApiUtils.buildSystemFrontendPath());
    const internalResponse = internalOutcome.value;
    if (internalResponse?.ok) {
      return ServerFetchOutcome.resolved(await internalResponse.json() as Record<string, unknown>);
    }

    const publicOutcome = await ServerApiUtils.serverFetchJsonOutcome(ServerApiUtils.buildSystemFrontendPath());
    // Only claim "unreachable" when BOTH paths failed to reach the API. If either answered,
    // an empty config is a real answer.
    if (publicOutcome.isUnreachable && internalOutcome.isUnreachable) {
      return ServerFetchOutcome.unreachable<Record<string, unknown>>(publicOutcome.error ?? internalOutcome.error);
    }
    return ServerFetchOutcome.resolved(publicOutcome.value as Record<string, unknown> | null);
  });

  /**
   * The outcome, so callers that make routing/content decisions from these settings can tell
   * "the platform has no such setting" from "the API was unreachable".
   */
  static async readOutcome(): Promise<ServerFetchOutcome<Record<string, unknown>>> {
    return FrontendConfigCache.configCache();
  }

  /** Lenient read for decorative surfaces (theme assets, plugin injections, prefetch hints). */
  static async read(): Promise<Record<string, unknown> | null> {
    return (await FrontendConfigCache.configCache()).value;
  }
}
