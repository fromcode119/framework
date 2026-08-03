import { RuntimeConstants } from '@fromcode119/core/client';
import { PageDocPrefetcher } from '@/lib/theme/page-doc-prefetcher';
import { PageDocPrefetchRequestCache } from '@/lib/theme/page-doc-prefetch-request-cache';

/**
 * Server Component: prefetches the theme's page-scoped `ui.prefetchApis` entries
 * (those declaring `fromPage`) using the RESOLVED page document, and injects the
 * payloads into `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}` via a body inline script.
 *
 * XSS-safety: the script body is built exclusively by PageDocPrefetcher.buildMergeScript,
 * which serializes through ThemeDataPrefetcher.safeSerialize — JSON with `<`, `>` and `&`
 * escaped to unicode sequences (the same script-injection contract ThemeAssets uses for
 * this global), so payload content can never close the script tag or inject markup.
 *
 * Rendered by the dynamic pages as a static RSC sibling (like SsrContentShell) —
 * the script executes long before the client-only theme boots, so theme consumers
 * read it synchronously through their PrefetchedDataService equivalent and paint
 * page data (e.g. the record a page renders) without a client XHR round-trip.
 */
export class PageDocPrefetchView {
  static async render({ content }: { content: unknown }) {

    try {
      // Shared per-request pass — SsrContentShell reads the SAME payloads for its LCP image.
      const results = await PageDocPrefetchRequestCache.read(content);
      if (!Object.keys(results).length) return null;
      return <script dangerouslySetInnerHTML={{ __html: PageDocPrefetcher.buildMergeScript(results) }} />;
    } catch (error) {
      // Non-critical — the theme keeps its client fetch fallback.
      console.error('[PageDocPrefetch] Error:', error);
      return null;
    }
  }
}
