import { ApiVersionUtils, LocalizationUtils, RuntimeConstants } from '@fromcode119/core/client';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { ServerApiUtils } from '@/lib/server-api/server-api';
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

    const internalBase = ServerApiPaths.buildInternalApiBaseUrl();
    const results: Record<string, unknown> = {};

    await Promise.allSettled(
      pageEntries.map(async (entry) => {
        const values = PageDocPrefetcher.deriveValues(doc, entry.fromPage as ThemePrefetchFromPageConfig);
        if (!values.length) return;

        const query = new URLSearchParams(
          typeof entry.query === 'object' && entry.query !== null ? entry.query : {},
        );
        query.set(String(entry.fromPage?.queryParam || '').trim(), values.join(','));
        const apiPath = ServerApiPaths.buildPluginPath(entry.pluginSlug, entry.path || '', query);
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

    await PageDocPrefetcher.prefetchDatasourceBlocks(doc, internalBase, results);
    return results;
  }

  /**
   * Records for every DATASOURCE block on the page — a block that names a plugin and one of its
   * datasources (`pluginSlug` + `datasourceKey`), which is how a collection block says "list this".
   *
   * Those blocks load their own records after mount, so server-side they render placeholders: a
   * category page went out with its heading and nothing else, giving search engines a catalogue with no
   * products in it. Prefetching here lets the block paint its records in the first response.
   *
   * Domain-agnostic: the plugin, the datasource and the paging all come from the BLOCK. The framework
   * names no plugin and knows nothing about what the records are.
   */
  private static async prefetchDatasourceBlocks(
    doc: unknown,
    internalBase: string,
    results: Record<string, unknown>,
  ): Promise<void> {
    const blocks = PageDocPrefetcher.blocksOf(PageDocPrefetcher.asRecord(doc));
    const seen = new Set<string>();

    await Promise.allSettled(blocks.map(async (block) => {
      const data = PageDocPrefetcher.asRecord(PageDocPrefetcher.asRecord(block)?.data) || PageDocPrefetcher.asRecord(block);
      const pluginSlug = PageDocPrefetcher.slugToken(data?.pluginSlug);
      const datasourceKey = PageDocPrefetcher.slugToken(data?.datasourceKey);
      if (!pluginSlug || !datasourceKey) return;

      // Keyed by the BLOCK, not by plugin+datasource. Two blocks on one page routinely name the SAME
      // datasource and narrow it differently — several sections of one catalogue, each filtered to its
      // own subset. Sharing a payload between them meant every section seeded from whichever block was
      // prefetched first, so records server-rendered under the wrong heading and only corrected
      // themselves after hydration. The block is the unit that asked, so the block is the key.
      const blockId = String(PageDocPrefetcher.asRecord(block)?.id || '').trim();
      if (!blockId) return;
      const key = `${PageDocPrefetcher.DATASOURCE_KEY_PREFIX}${blockId}`;
      if (seen.has(key)) return;
      seen.add(key);

      const query = new URLSearchParams();
      const limit = Number(data?.limit);
      if (Number.isFinite(limit) && limit > 0) query.set('limit', String(Math.floor(limit)));
      const sort = String(data?.sort || '').trim();
      if (sort) query.set('sort', sort);

      const apiPath = ServerApiPaths.buildPluginPath(pluginSlug, datasourceKey, query);
      try {
        const response = await fetch(`${internalBase}${ApiVersionUtils.prefix()}${apiPath}`, {
          next: { revalidate: PageDocPrefetcher.CACHE_REVALIDATE_SECONDS },
        } as RequestInit);
        if (response.ok) results[key] = await response.json();
      } catch {
        // Non-critical — the block keeps its client fetch fallback.
      }
    }));
  }

  /**
   * The key a datasource payload lands under — `datasource:<blockId>`, so the rendering plugin reads the
   * payload fetched for ITS OWN block and nothing else.
   */
  static readonly DATASOURCE_KEY_PREFIX = 'datasource:';

  private static blocksOf(record: Record<string, unknown> | null): unknown[] {
    const content = record?.content;
    if (Array.isArray(content)) return content;
    return (Object.values(PageDocPrefetcher.asRecord(content) || {}).find(Array.isArray) as unknown[]) || [];
  }

  /** A plugin slug / datasource key is a path segment; anything else is not addressable. */
  private static slugToken(raw: unknown): string {
    const value = String(raw ?? '').trim();
    return /^[a-z0-9][a-z0-9_-]*$/i.test(value) ? value : '';
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

  /**
   * A document/block field holding a slug, reduced to the slug itself.
   *
   * Two shapes reach here that a bare `String(raw)` silently destroyed, and because a value that
   * fails the slug test is dropped without a word, the whole prefetch then produced NOTHING and the
   * page rendered its loading state server-side — no price, no delivery estimate — with nothing
   * anywhere saying why:
   *
   * - A LOCALIZED field is a locale map (`{bg: 'individualna-ritualna-kutia'}`), not a string.
   *   `String()` on it yields `[object Object]`, which the slug test then rejects. Any localized
   *   site — the reason the field is a map at all — lost every block slug this way.
   * - A nested page's slug is a PATH (`<parent>/<child>`). The slug test rejects the separator, so
   *   `pageSlug` contributed nothing for any page below the root. The record is identified by the
   *   last segment, which is the slug the endpoint is queried by.
   */
  private static toSlug(raw: unknown): string {
    // The locale-map branch is chosen by SHAPE — is this an object? — not by
    // `LocalizationUtils.hasLocalizedValue`, which answers "is there a value here at all" and is true
    // for a plain string too. Routing strings through the map reader returns nothing, which silently
    // dropped every non-localized slug and took the price with it.
    const localeMap = PageDocPrefetcher.asRecord(raw);
    const text = localeMap
      ? Object.values(LocalizationUtils.toLocaleMap(localeMap)).map((entry) => String(entry || '').trim()).find(Boolean) || ''
      : String(raw ?? '').trim();
    return text.split('/').filter(Boolean).pop() || '';
  }

  private static pushValue(values: string[], raw: unknown): void {
    const value = PageDocPrefetcher.toSlug(raw);
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
