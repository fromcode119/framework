import { PagePrefetch } from '@fromcode119/core/client';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';

/**
 * Server Component: one prefetch payload as inert JSON — `<script type="application/json"
 * data-fc-page-prefetch>`. `PagePrefetch` parses every such block in document order and merges them, so
 * the head's theme-wide payload and the body's page-scoped one combine without any script running.
 *
 * XSS-safety: `ThemeDataPrefetcher.safeSerialize` escapes `<`, `>` and `&` to unicode sequences, so the
 * payload can never close the element or inject markup; a JSON block is never executed.
 */
export class PagePrefetchScriptView {
  static render({ payload }: { payload: Record<string, unknown> }) {
    if (!Object.keys(payload).length) return null;
    const marker = { [PagePrefetch.SCRIPT_ATTRIBUTE]: '' };
    return <script type="application/json" {...marker} dangerouslySetInnerHTML={{ __html: ThemeDataPrefetcher.safeSerialize(payload) }} />;
  }
}
