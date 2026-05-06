import { ServerApiUtils } from '../server-api';
import type { ThemePrefetchApiEntry, LcpImagePreload } from './theme-data-prefetcher.interfaces';

export type { ThemePrefetchApiEntry, LcpImagePreload } from './theme-data-prefetcher.interfaces';

/**
 * Fetches plugin data server-side based on theme.json `ui.prefetchApis` config
 * and returns a record keyed by the declared entry `key`.
 *
 * The caller should inject the result as `window.__FROMCODE_PAGE_PREFETCH__`
 * so theme components can hydrate immediately without waiting for a client-side
 * API round-trip.
 *
 * @example theme.json
 * ```json
 * "ui": {
 *   "prefetchApis": [
 *     { "key": "products", "pluginSlug": "ecommerce", "path": "/products", "query": { "limit": "50" } }
 *   ]
 * }
 * ```
 */
export class ThemeDataPrefetcher {
  private static readonly CACHE_REVALIDATE_SECONDS = 30;

  static async prefetch(theme: Record<string, any>): Promise<Record<string, unknown>> {
    const apis = Array.isArray(theme.ui?.prefetchApis)
      ? (theme.ui.prefetchApis as ThemePrefetchApiEntry[])
      : [];
    if (!apis.length) return {};

    const internalBase = ServerApiUtils.buildInternalApiBaseUrl();
    const results: Record<string, unknown> = {};

    await Promise.allSettled(
      apis.map(async (entry) => {
        const key = String(entry?.key || '').trim();
        const pluginSlug = String(entry?.pluginSlug || '').trim();
        if (!key || !pluginSlug) return;

        const query = new URLSearchParams(
          typeof entry.query === 'object' && entry.query !== null ? entry.query : {},
        );
        const apiPath = ServerApiUtils.buildPluginPath(pluginSlug, entry.path || '', query);
        const url = `${internalBase}${apiPath}`;
        try {
          const response = await fetch(url, {
            next: { revalidate: ThemeDataPrefetcher.CACHE_REVALIDATE_SECONDS },
          } as RequestInit);
          if (response.ok) results[key] = await response.json();
        } catch {
          // Non-critical — page still works without prefetch for this entry
        }
      }),
    );

    return results;
  }

  /**
   * Extracts LCP image URL from prefetched API data based on the `lcp` config
   * in each `prefetchApis` entry. Returns null when no match is found.
   *
   * Used by ThemeAssets to inject `<link rel="preload" as="image">` in `<head>`,
   * eliminating the resource load delay caused by waiting for JS to render.
   *
   * @example theme.json lcp config
   * ```json
   * "lcp": {
   *   "imagePath": "items.0.imageUrl",
   *   "urlTemplate": "/api/v1/plugins/cms/img?src={value}&w={width}&q=60",
   *   "widths": [360, 520, 680, 800],
   *   "sizes": "(max-width: 48em) 100vw, (max-width: 62em) 92vw, 50vw"
   * }
   * ```
   */
  static extractLcpImageUrl(
    prefetchData: Record<string, unknown>,
    apis: ThemePrefetchApiEntry[],
    publicApiBase: string,
  ): LcpImagePreload | null {
    for (const entry of apis) {
      const lcp = entry.lcp;
      if (!lcp?.imagePath || !lcp?.urlTemplate) continue;
      const data = prefetchData[entry.key];
      if (!data) continue;
      const rawValue = ThemeDataPrefetcher.getNestedValue(data, lcp.imagePath);
      if (!rawValue || typeof rawValue !== 'string') continue;

      const encodedValue = encodeURIComponent(rawValue);
      const buildUrl = (w: number): string => {
        const path = lcp.urlTemplate.replace('{value}', encodedValue).replace('{width}', String(w));
        return path.startsWith('http') ? path : `${publicApiBase}${path}`;
      };

      if (lcp.widths?.length) {
        const imageSrcSet = lcp.widths.map((w) => `${buildUrl(w)} ${w}w`).join(', ');
        const largest = lcp.widths[lcp.widths.length - 1];
        return { href: buildUrl(largest), imageSrcSet, imageSizes: lcp.sizes };
      }

      return { href: buildUrl(lcp.defaultWidth ?? 680) };
    }
    return null;
  }

  static safeSerialize(data: Record<string, unknown>): string {
    return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  }

  private static getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current)) {
        const idx = parseInt(key, 10);
        return !isNaN(idx) && idx >= 0 ? current[idx] : undefined;
      }
      if (typeof current === 'object') return (current as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }
}
