import { ApiVersionUtils, RuntimeConstants } from '@fromcode119/core/client';
import { ServerApiUtils } from '@/lib/server-api';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';
import type { ThemePrefetchApiEntry } from '@/lib/theme/theme-prefetch-api-entry';
import type { ThemePrefetchFromPageConfig } from '@/lib/theme/theme-prefetch-from-page-config';

/**
 * Per-PAGE companion to ThemeDataPrefetcher. Static `ui.prefetchApis` entries are
 * page-agnostic (same payload on every route); entries that declare `fromPage`
 * derive a query param from the RESOLVED page document — e.g. the page's own slug
 * or the slug references inside its content blocks — so the server can prefetch
 * exactly the records THIS page will render (a product page's product data) and
 * the theme paints its above-the-fold record data without a client XHR.
 *
 * Domain-agnostic by construction: the framework only reads generic document/block
 * shapes (`slug`, block `data.slugs`/`productSlugs`/`productSlug`); the theme's
 * `theme.json` decides which plugin endpoint the values feed and under which key
 * the payload lands. Results are merged into `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}`
 * by the PageDocPrefetch server component (body script — runs long before the
 * client-only theme boots).
 *
 * Only anonymous-safe endpoints may be declared (same contract as the static
 * prefetch): the fetch is unauthenticated and the payload lands in shared HTML.
 */
export class PageDocPrefetcher {
  private static readonly CACHE_REVALIDATE_SECONDS = 30;
  private static readonly DEFAULT_MAX_VALUES = 3;

  static async prefetch(doc: unknown, theme: Record<string, any>): Promise<Record<string, unknown>> {
    const apis = Array.isArray(theme?.ui?.prefetchApis)
      ? (theme.ui.prefetchApis as ThemePrefetchApiEntry[])
      : [];
    const pageEntries = apis.filter((entry) => entry?.fromPage && entry.key && entry.pluginSlug);
    if (!pageEntries.length) return {};

    const internalBase = ServerApiUtils.buildInternalApiBaseUrl();
    const results: Record<string, unknown> = {};

    await Promise.allSettled(
      pageEntries.map(async (entry) => {
        const values = PageDocPrefetcher.deriveValues(doc, entry.fromPage as ThemePrefetchFromPageConfig);
        if (!values.length) return;

        const query = new URLSearchParams(
          typeof entry.query === 'object' && entry.query !== null ? entry.query : {},
        );
        query.set(String(entry.fromPage?.queryParam || '').trim(), values.join(','));
        const apiPath = ServerApiUtils.buildPluginPath(entry.pluginSlug, entry.path || '', query);
        const url = `${internalBase}${ApiVersionUtils.prefix()}${apiPath}`;
        try {
          const response = await fetch(url, {
            next: { revalidate: PageDocPrefetcher.CACHE_REVALIDATE_SECONDS },
          } as RequestInit);
          if (response.ok) results[String(entry.key).trim()] = await response.json();
        } catch {
          // Non-critical — the theme keeps its client fetch fallback.
        }
      }),
    );

    return results;
  }

  /** Inline-script body that merges page-scoped payloads into the shared prefetch global. */
  static buildMergeScript(results: Record<string, unknown>): string {
    return `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}=Object.assign(window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}||{},${ThemeDataPrefetcher.safeSerialize(results)});`;
  }

  static deriveValues(doc: unknown, config: ThemePrefetchFromPageConfig): string[] {
    const queryParam = String(config?.queryParam || '').trim();
    if (!queryParam) return [];
    const sources = Array.isArray(config.sources) && config.sources.length ? config.sources : ['pageSlug'];
    const maxValues = Number.isFinite(config.maxValues) && Number(config.maxValues) > 0
      ? Number(config.maxValues)
      : PageDocPrefetcher.DEFAULT_MAX_VALUES;

    const values: string[] = [];
    const record = PageDocPrefetcher.asRecord(doc);
    for (const source of sources) {
      if (source === 'pageSlug') {
        PageDocPrefetcher.pushValue(values, record?.slug);
      } else if (source === 'blockSlugs') {
        PageDocPrefetcher.collectBlockSlugs(values, record);
      }
    }
    return values.slice(0, maxValues);
  }

  private static collectBlockSlugs(values: string[], record: Record<string, unknown> | null): void {
    const content = record?.content;
    const blocks = Array.isArray(content)
      ? content
      : Object.values(PageDocPrefetcher.asRecord(content) || {}).find(Array.isArray) || [];
    for (const block of blocks as unknown[]) {
      const blockRecord = PageDocPrefetcher.asRecord(block);
      if (!blockRecord) continue;
      const data = PageDocPrefetcher.asRecord(blockRecord.data) || blockRecord;
      for (const key of ['slugs', 'productSlugs']) {
        for (const item of Array.isArray(data[key]) ? (data[key] as unknown[]) : []) {
          const itemRecord = PageDocPrefetcher.asRecord(item);
          PageDocPrefetcher.pushValue(values, itemRecord ? (itemRecord.slug ?? itemRecord.productSlug) : item);
        }
      }
      PageDocPrefetcher.pushValue(values, data.productSlug);
    }
  }

  private static pushValue(values: string[], raw: unknown): void {
    const value = String(raw ?? '').trim();
    // Slug-shaped values only — these are interpolated into a query string.
    if (!value || !/^[a-z0-9][a-z0-9_-]*$/i.test(value)) return;
    if (!values.includes(value)) values.push(value);
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
