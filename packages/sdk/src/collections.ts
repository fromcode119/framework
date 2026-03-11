import { ApiVersionUtils } from './api-version';
import { SystemConstants } from './constants';
import type { CollectionListPathOptions } from './collections.interfaces';

/**
 * Collection path and data utilities.
 *
 * @example
 * CollectionUtils.listPath('products')          // "/api/v1/collections/products"
 * CollectionUtils.docPath('products', '123')    // "/api/v1/collections/products/123"
 * CollectionUtils.extractDocs(response)         // []
 */
export class CollectionUtils {
  private static basePath(): string {
    return `${ApiVersionUtils.prefix()}${SystemConstants.API_PATH.COLLECTIONS.BASE}`;
  }

  static listPath(slug: string, options: CollectionListPathOptions = {}): string {
    const s = String(slug || '').trim();
    if (!s) return CollectionUtils.basePath();

    const params = new URLSearchParams();
    const limit = Number(options.limit);
    if (Number.isFinite(limit) && limit > 0) params.set('limit', String(limit));

    if (options.search) {
      const search = String(options.search).trim();
      if (search) params.set('search', search);
    }

    for (const [key, value] of Object.entries(options.filters || {})) {
      const k = String(key || '').trim();
      if (!k || value === undefined || value === null) continue;
      const v = String(value).trim();
      if (v) params.set(k, v);
    }

    const query = params.toString();
    const base = `${CollectionUtils.basePath()}/${encodeURIComponent(s)}`;
    return query ? `${base}?${query}` : base;
  }

  static docPath(slug: string, id: string | number): string {
    const s = String(slug || '').trim();
    const i = String(id || '').trim();
    if (!s || !i) return CollectionUtils.basePath();
    return `${CollectionUtils.basePath()}/${encodeURIComponent(s)}/${encodeURIComponent(i)}`;
  }

  static extractDocs(response: unknown): unknown[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray((response as any)?.docs)) return (response as any).docs;
    return [];
  }
}