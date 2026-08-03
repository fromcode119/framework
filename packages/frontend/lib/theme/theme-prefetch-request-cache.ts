import { cache } from 'react';
import { RuntimeConstants } from '@fromcode119/core/client';

import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';

/**
 * Per-request memoized theme prefetch (React `cache()`), mirroring the pattern used by
 * `DynamicPageResolver.resolveFetchCache` and `ResolvedContentMetadata.seoHeadDataCache`.
 *
 * Two server-side consumers share the SAME prefetch pass within one request:
 *  - `ThemeAssets` (head): injects `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}` + LCP image preload.
 *  - `SsrContentShell` (body): paints the above-the-fold shell (nav + h1 + intro text).
 *
 * React `cache()` guarantees a single `ThemeDataPrefetcher.prefetch()` execution per
 * request across the whole RSC render (layout + page), and the per-entry `fetch()` calls
 * inside the prefetcher are additionally deduped by Next's request memoization — so no
 * plugin endpoint is ever hit twice for one document render.
 */
export class ThemePrefetchRequestCache {
  private static readonly prefetchCache = cache(async (): Promise<Record<string, unknown>> => {
    const config = await FrontendConfigCache.read() as Record<string, any> | null;
    const theme = config?.activeTheme;
    if (!theme?.slug) {
      return {};
    }
    return ThemeDataPrefetcher.prefetch(theme);
  });

  static read(): Promise<Record<string, unknown>> {
    return ThemePrefetchRequestCache.prefetchCache();
  }
}
