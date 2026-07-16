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

export interface ThemePrefetchApiEntry {
  key: string;
  pluginSlug: string;
  path?: string;
  query?: Record<string, string>;
  /** Optional LCP image extraction config for server-side `<link rel="preload" as="image">` */
  lcp?: ThemeLcpConfig;
  /**
   * Marks this entry's payload as the primary navigation menu for the server-rendered
   * above-the-fold shell (`#fc-ssr-shell`). The framework stays menu-source-agnostic:
   * the theme declares WHICH prefetched payload is its main nav; the shell only reads
   * the generic `{ items: [{ label, url|href }] }` shape from it.
   */
  ssrShellNav?: boolean;
}

export interface LcpImagePreload {
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
}
