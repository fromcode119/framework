import { RuntimeConstants } from '@fromcode119/core/client';
import type { IThemeLcpConfig } from '@/lib/theme/interfaces/theme-lcp-config.interface';
import type { ThemePrefetchFromPageConfig } from '@/lib/theme/theme-prefetch-from-page-config';

export class ThemePrefetchApiEntry {
  declare key: string;
  declare pluginSlug: string;
  declare path?: string;
  declare query?: Record<string, string>;
  /** Optional LCP image extraction config for server-side `<link rel="preload" as="image">` */
  declare lcp?: IThemeLcpConfig;
  /**
   * Per-page prefetch: derive an extra query param from the resolved page document.
   * Entries WITH `fromPage` are skipped by the static per-request prefetch pass
   * (ThemeDataPrefetcher) and instead fetched by PageDocPrefetcher, which has the
   * resolved document; their payloads are merged into `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}`
   * from the page body before the theme boots.
   */
  declare fromPage?: ThemePrefetchFromPageConfig;
}
