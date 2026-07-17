import { RuntimeConstants } from '@fromcode119/core/client';
export interface ThemeLcpConfig {
  /** Dot-notation path into the API response, e.g. "items.0.imageUrl" */
  imagePath: string;
  /** URL template with `{value}` (encoded) and optional `{width}` placeholders */
  urlTemplate: string;
  /** Widths for srcset generation, e.g. [360, 520, 680, 800] */
  widths?: number[];
  /** sizes attribute for the preload link, e.g. "(max-width: 48em) 100vw, 450px" */
  sizes?: string;
  /** Fallback width when `widths` is not provided */
  defaultWidth?: number;
}

export interface ThemePrefetchFromPageConfig {
  /** Query param the derived values are joined into (comma-separated), e.g. "slugs". */
  queryParam: string;
  /**
   * Where the values come from on the RESOLVED page document (framework stays
   * domain-agnostic — these are generic document/block shapes, not plugin keys):
   *  - 'pageSlug': the document's own slug.
   *  - 'blockSlugs': slug references found in the document's content blocks
   *    (generic `slugs`/`productSlugs`/`productSlug`/`slug` keys under block `data`).
   * Defaults to ['pageSlug'].
   */
  sources?: ('pageSlug' | 'blockSlugs')[];
  /** Cap on derived values (default 3) so the injected payload stays small. */
  maxValues?: number;
}

export interface ThemePrefetchApiEntry {
  key: string;
  pluginSlug: string;
  path?: string;
  query?: Record<string, string>;
  /** Optional LCP image extraction config for server-side `<link rel="preload" as="image">` */
  lcp?: ThemeLcpConfig;
  /**
   * Per-page prefetch: derive an extra query param from the resolved page document.
   * Entries WITH `fromPage` are skipped by the static per-request prefetch pass
   * (ThemeDataPrefetcher) and instead fetched by PageDocPrefetcher, which has the
   * resolved document; their payloads are merged into `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}`
   * from the page body before the theme boots.
   */
  fromPage?: ThemePrefetchFromPageConfig;
}

export interface LcpImagePreload {
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
}
