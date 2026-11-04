import { ApiVersionUtils } from '@fromcode119/core/client';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';

/**
 * The records a PLUGIN's own page needs in its first response — the plugin's manifest `ui.pagePrefetch`
 * (see `IPluginPagePrefetchEntry` in core).
 *
 * A storefront component cannot fetch while the page is server-rendered, so a list a plugin page loads after
 * mount went out as a spinner. Each entry names one of the declaring plugin's OWN routes for pages of one
 * `recipe`; it is fetched here, before the render, and published under `<pluginSlug>:<key>` as
 * `{ query, data }`, where `query` is exactly what was asked (sorted). The component uses the payload only
 * when it would ask the same, so a payload never paints records the component would not show.
 *
 * Domain-agnostic: the plugin, its route and its parameters all come from the plugin's manifest; the
 * framework names no plugin and knows nothing about what the records are.
 */
export class PluginPagePrefetcher {
  static async prefetch(
    doc: unknown,
    plugins: unknown,
    requestSearch: string,
    internalBase: string,
    results: Record<string, unknown>,
  ): Promise<void> {
    const recipe = String(PluginPagePrefetcher.asRecord(doc)?.recipe ?? '').trim();
    if (!recipe || !Array.isArray(plugins)) return;
    const address = new URLSearchParams(requestSearch);

    const requests: Array<Promise<void>> = [];
    for (const plugin of plugins) {
      const record = PluginPagePrefetcher.asRecord(plugin);
      const slug = PluginPagePrefetcher.token(record?.slug);
      const entries = PluginPagePrefetcher.asRecord(record?.ui)?.pagePrefetch;
      if (!slug || !Array.isArray(entries)) continue;
      for (const raw of entries) {
        const entry = PluginPagePrefetcher.asRecord(raw);
        const key = PluginPagePrefetcher.token(entry?.key);
        const path = String(entry?.path ?? '').trim();
        if (String(entry?.recipe ?? '').trim() !== recipe || !key || !PluginPagePrefetcher.isRoutePath(path)) continue;
        const query = PluginPagePrefetcher.queryOf(entry, address);
        requests.push((async () => {
          const apiPath = ServerApiPaths.buildPluginPath(slug, path, query);
          const data = await ThemeDataPrefetcher.fetchEntry(`${internalBase}${ApiVersionUtils.prefix()}${apiPath}`);
          if (data !== undefined) results[`${slug}:${key}`] = { query: query.toString(), data };
        })());
      }
    }
    await Promise.allSettled(requests);
  }

  /** The entry's fixed parameters plus those it takes from the page address, sorted — the form a component compares. */
  static queryOf(entry: Record<string, unknown> | null, address: URLSearchParams): URLSearchParams {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(PluginPagePrefetcher.asRecord(entry?.query) || {})) {
      const text = String(value ?? '').trim();
      if (name && text && Object(value) !== value) query.set(name, text);
    }
    for (const [from, to] of Object.entries(PluginPagePrefetcher.asRecord(entry?.requestQuery) || {})) {
      const value = String(address.get(from) ?? '').trim();
      const target = String(to ?? '').trim();
      if (from && target && value) query.set(target, value);
    }
    query.sort();
    return query;
  }

  /** A plugin slug / entry key: one path-safe token. */
  private static token(raw: unknown): string {
    const value = String(raw ?? '').trim();
    return /^[a-z0-9][a-z0-9_-]*$/i.test(value) ? value : '';
  }

  /** A route below the plugin's base: path-safe segments only, never `..`, a scheme or a query. */
  private static isRoutePath(path: string): boolean {
    return /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i.test(path);
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }
}
