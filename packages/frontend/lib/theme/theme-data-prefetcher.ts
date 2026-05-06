import { ServerApiUtils } from '../server-api';

interface ThemePrefetchApiEntry {
  key: string;
  pluginSlug: string;
  path?: string;
  query?: Record<string, string>;
}

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

  static safeSerialize(data: Record<string, unknown>): string {
    return JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  }
}
