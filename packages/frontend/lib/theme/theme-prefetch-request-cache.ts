import { SiteRevisionMemo } from '@/lib/site-revision-memo';
import { RuntimeConstants } from '@fromcode119/core/client';

import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';

/**
 * Memoized theme prefetch — kept across anonymous requests at the site's revision (`SiteRevisionMemo`), per request otherwise, mirroring the pattern used by
 * `DynamicPageResolver.resolveFetchCache` and `ResolvedContentMetadata.headDataCache`.
 *
 * Two server-side consumers share the SAME prefetch pass within one request:
 *  - `ThemeAssets` (head): injects the page's prefetch JSON (`PagePrefetch`) + LCP image preload.
 *  - `SsrContentShell` (body): paints the above-the-fold shell (nav + h1 + intro text).
 *
 * `RequestScope.memo` guarantees a single `ThemeDataPrefetcher.prefetch()` execution per
 * request across the whole RSC render (layout + page), and the per-entry `fetch()` calls
 * inside the prefetcher are additionally deduped by Next's request memoization — so no
 * plugin endpoint is ever hit twice for one document render.
 */
export class ThemePrefetchRequestCache {
  private static readonly prefetchCache = SiteRevisionMemo.memo(async (): Promise<Record<string, unknown>> => {
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
