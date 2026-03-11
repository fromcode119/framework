/**
 * URL construction and manipulation utilities.
 *
 * Centralises all URL-building logic so no component or service
 * hard-codes URL patterns.
 *
 * @example
 * ```typescript
 * import { UrlUtils } from '@fromcode119/sdk';
 *
 * UrlUtils.build('/products', { page: 2, limit: 20 }); // '/products?page=2&limit=20'
 * UrlUtils.isExternal('https://cdn.example.com');       // true
 * UrlUtils.joinPaths('/api/v1', 'plugins', 'ecommerce'); // '/api/v1/plugins/ecommerce'
 * ```
 */
export class UrlUtils {
  /**
   * Builds a URL from a base path and optional query parameters.
   */
  static build(base: string, params?: Record<string, string | number | boolean | null | undefined>): string {
    if (!params || Object.keys(params).length === 0) return base;
    const [path, existing] = base.split('?');
    const searchParams = new URLSearchParams(existing ?? '');
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    return qs ? `${path}?${qs}` : (path ?? base);
  }

  /**
   * Safely joins URL path segments, preventing double slashes.
   *
   * @example
   * UrlUtils.joinPaths('/api/v1', 'plugins', '/ecommerce/') // '/api/v1/plugins/ecommerce'
   */
  static joinPaths(...segments: string[]): string {
    return segments
      .map((s, i) => {
        s = String(s ?? '').trim();
        if (i > 0) s = s.replace(/^\/+/, '');
        if (i < segments.length - 1) s = s.replace(/\/+$/, '');
        return s;
      })
      .filter(Boolean)
      .join('/');
  }

  /**
   * Returns true if the URL is external (has http:// or https:// scheme).
   */
  static isExternal(url: string): boolean {
    return /^https?:\/\//i.test(String(url ?? ''));
  }

  /**
   * Parses a query string (with or without leading '?') into a plain object.
   *
   * @example
   * UrlUtils.parseQuery('?page=1&limit=20') // { page: '1', limit: '20' }
   */
  static parseQuery(search: string): Record<string, string> {
    const qs = String(search ?? '').replace(/^\?/, '');
    const result: Record<string, string> = {};
    if (!qs) return result;
    const params = new URLSearchParams(qs);
    params.forEach((value, key) => { result[key] = value; });
    return result;
  }

  /**
   * Extracts a single query parameter from a URL string or query string.
   * Returns fallback if the key is not found.
   */
  static getParam(url: string, key: string, fallback?: string): string | undefined {
    const [, qs] = String(url ?? '').split('?');
    const params = new URLSearchParams(qs ?? '');
    return params.get(key) ?? fallback;
  }

  /**
   * Removes trailing slash(es) from a URL or path string.
   *
   * @example
   * UrlUtils.trimTrailingSlash('https://api.example.com/') // 'https://api.example.com'
   */
  static trimTrailingSlash(value: string): string {
    return String(value ?? '').replace(/\/+$/, '');
  }
}