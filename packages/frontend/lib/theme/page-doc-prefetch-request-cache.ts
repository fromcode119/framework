import { RuntimeConstants } from '@fromcode119/core/client';
import { cache } from 'react';
import { FrontendConfigCache } from '../frontend-config-cache';
import { PageDocPrefetcher } from './page-doc-prefetcher';

/**
 * Per-request memoized page-scoped prefetch (React `cache()`), mirroring
 * ThemePrefetchRequestCache. Keyed by the resolved document REFERENCE — the page
 * passes the exact same `content` object to both consumers, so the fetch pass
 * runs once per request:
 *  - `SsrContentShell` (body): extracts the page's LCP image from the payload
 *    (via the entry's `lcp` config) when the document itself carries no image.
 *  - `PageDocPrefetch` (body): injects the payloads into
 *    `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}` for the theme.
 */
export class PageDocPrefetchRequestCache {
  private static readonly prefetchCache = cache(async (doc: unknown): Promise<Record<string, unknown>> => {
    const config = await FrontendConfigCache.read() as Record<string, any> | null;
    const theme = config?.activeTheme;
    if (!theme?.slug) {
      return {};
    }
    return PageDocPrefetcher.prefetch(doc, theme);
  });

  static read(doc: unknown): Promise<Record<string, unknown>> {
    return PageDocPrefetchRequestCache.prefetchCache(doc);
  }
}
