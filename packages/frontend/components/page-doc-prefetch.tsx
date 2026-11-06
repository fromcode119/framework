import { PagePrefetchScriptView } from '@/components/page-prefetch-script';
import { PageDocPrefetcher } from '@/lib/theme/page-doc-prefetcher';
import { PageDocPrefetchRequestCache } from '@/lib/theme/page-doc-prefetch-request-cache';

/**
 * Server Component: prefetches the theme's page-scoped `ui.prefetchApis` entries
 * (those declaring `fromPage`) using the RESOLVED page document, and emits the
 * payloads as an inert JSON block (`PagePrefetchScriptView`), which `PagePrefetch`
 * merges with the head's payload in the browser.
 *
 * Rendered by the dynamic pages as a static RSC sibling (like SsrContentShell) —
 * the block is in the document long before the client-only theme boots, so theme
 * consumers read it synchronously through `PagePrefetch.get(key)` and paint
 * page data (e.g. the record a page renders) without a client XHR round-trip.
 */
export class PageDocPrefetchView {
  /** `plugin` / `type`: whom the content was resolved from — the same pair the theme render was given. */
  static async render({ content, plugin = '', type = '' }: { content: unknown; plugin?: string; type?: string }) {

    try {
      // Shared per-request pass — SsrContentShell reads the SAME payloads for its LCP image.
      const results = await PageDocPrefetchRequestCache.read(content, '', plugin, type);
      if (!Object.keys(results).length) return null;
      return <PagePrefetchScriptView.render payload={results} />;
    } catch (error) {
      // Non-critical — the theme keeps its client fetch fallback.
      console.error('[PageDocPrefetch] Error:', error);
      return null;
    }
  }
}
