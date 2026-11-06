import { ApiVersionUtils } from '@fromcode119/core/client';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';
import type { IResolvedDocOrigin } from '@/lib/interfaces/resolved-doc-origin.interface';

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
 * An entry with a `collection` instead applies to that plugin's own RECORD pages — a record the site
 * resolved at an address — and its route's `:field` segments take the record's own fields. A product page
 * rendered from the bare record went out without the pictures, which only its route resolves; it now starts
 * from the route's answer.
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
    origin: IResolvedDocOrigin = { plugin: '', type: '' },
  ): Promise<void> {
    const record = PluginPagePrefetcher.asRecord(doc);
    const recipe = String(record?.recipe ?? '').trim();
    const owner = PluginPagePrefetcher.token(origin.plugin);
    const type = PluginPagePrefetcher.token(origin.type);
    if ((!recipe && !(owner && type)) || !Array.isArray(plugins)) return;
    const address = new URLSearchParams(requestSearch);

    const requests: Array<Promise<void>> = [];
    for (const plugin of plugins) {
      const declared = PluginPagePrefetcher.asRecord(plugin);
      const slug = PluginPagePrefetcher.token(declared?.slug);
      const entries = PluginPagePrefetcher.asRecord(declared?.ui)?.pagePrefetch;
      if (!slug || !Array.isArray(entries)) continue;
      for (const raw of entries) {
        const entry = PluginPagePrefetcher.asRecord(raw);
        const key = PluginPagePrefetcher.token(entry?.key);
        const forRecipe = String(entry?.recipe ?? '').trim();
        const forCollection = String(entry?.collection ?? '').trim();
        // A recipe page of any plugin, or a record page of THIS plugin's own collection — never another's.
        const applies = forRecipe ? forRecipe === recipe : Boolean(forCollection) && slug === owner && forCollection === type;
        const path = applies && key ? PluginPagePrefetcher.routeFor(String(entry?.path ?? '').trim(), forRecipe ? null : record) : '';
        if (!path) continue;
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

  /**
   * The entry's route, its `:field` segments filled from the record (`products/:slug`), or `''` when it is
   * not one of the plugin's own routes or names a field the record does not hold as one path segment. A
   * recipe page has no record: its route takes no fields.
   */
  static routeFor(path: string, record: Record<string, unknown> | null): string {
    const segments = path.split('/');
    const filled: string[] = [];
    for (const segment of segments) {
      if (!segment.startsWith(':')) {
        if (!PluginPagePrefetcher.isRoutePath(segment)) return '';
        filled.push(segment);
        continue;
      }
      const field = segment.slice(1);
      const value = record && PluginPagePrefetcher.isRoutePath(field) && Object(record[field]) !== record[field] ? String(record[field] ?? '').trim() : '';
      if (!value || value.includes('/') || value === '.' || value === '..') return '';
      filled.push(encodeURIComponent(value));
    }
    return filled.join('/');
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
