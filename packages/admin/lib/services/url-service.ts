import { BaseService } from './base-service';

/**
 * Service for URL construction and manipulation utilities.
 *
 * @example
 * ```typescript
 * const services = AdminServices.getInstance();
 * const url = services.url.build('/api/v1/products', { page: '2', limit: '20' });
 * const ok  = services.url.isExternal('https://example.com'); // true
 * const q   = services.url.parseQuery('?page=1&limit=20'); // { page: '1', limit: '20' }
 * ```
 */
export class UrlService extends BaseService {
  /**
   * Builds a URL from a base path and optional query parameters.
   * Handles existing query strings gracefully.
   */
  build(base: string, params?: Record<string, string | number | boolean | null | undefined>): string {
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
   */
  joinPaths(...segments: string[]): string {
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
   * Returns true if the URL is external (starts with a protocol).
   */
  isExternal(url: string): boolean {
    return /^https?:\/\//i.test(String(url ?? ''));
  }

  /**
   * Parses a query string (with or without leading '?') into a plain object.
   */
  parseQuery(search: string): Record<string, string> {
    const qs = String(search ?? '').replace(/^\?/, '');
    const result: Record<string, string> = {};
    if (!qs) return result;
    for (const [key, value] of new URLSearchParams(qs)) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Safely extracts a single query parameter from a URL or query string.
   */
  getParam(url: string, key: string, fallback?: string): string | undefined {
    const [, qs] = String(url ?? '').split('?');
    const params = new URLSearchParams(qs ?? '');
    return params.get(key) ?? fallback;
  }
}