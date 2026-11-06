import { RequestScope } from '@/lib/request-scope';
import { RuntimeConstants } from '@fromcode119/core/client';

import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { PageDocPrefetcher } from '@/lib/theme/page-doc-prefetcher';

/**
 * Per-request memoized page-scoped prefetch (`RequestScope.memo`), mirroring
 * ThemePrefetchRequestCache. Keyed by the resolved document REFERENCE — the page
 * passes the exact same `content` object to both consumers, so the fetch pass
 * runs once per request:
 *  - `SsrContentShell` (body): extracts the page's LCP image from the payload
 *    (via the entry's `lcp` config) when the document itself carries no image.
 *  - `PageDocPrefetch` (body): injects the payloads into
 *    the page's prefetch JSON (`PagePrefetch`) for the theme.
 */
export class PageDocPrefetchRequestCache {
  // Plain strings, not an origin object: the memo keys an object by its identity, so two callers passing
  // equal origins would each fetch.
  private static readonly prefetchCache = RequestScope.memo(async (doc: unknown, requestSearch: string, plugin: string, type: string): Promise<Record<string, unknown>> => {
    const config = await FrontendConfigCache.read() as Record<string, any> | null;
    const theme = config?.activeTheme;
    if (!theme?.slug) {
      return {};
    }
    return PageDocPrefetcher.prefetch(doc, theme, config?.plugins, requestSearch, { plugin, type });
  });

  /**
   * `requestSearch`: the page address's query string, which plugin-declared page entries read; `plugin` and
   * `type`: whom the document was resolved from, which a plugin's record-page entries match.
   */
  static read(doc: unknown, requestSearch = '', plugin = '', type = ''): Promise<Record<string, unknown>> {
    return PageDocPrefetchRequestCache.prefetchCache(doc, requestSearch, plugin, type);
  }
}
