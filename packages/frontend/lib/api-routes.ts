import { ApiVersionUtils } from '@fromcode119/core/client';
import { FrontendApiBaseUrl } from './api-base-url';

export class FrontendApiRoutes {
  static readonly VERSION = ApiVersionUtils.prefix();
  static readonly VERSION_PREFIX = ApiVersionUtils.prefix();

  static buildFrontendApiUrl(path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
      const apiPrefix = `${FrontendApiBaseUrl.resolveFrontendApiBaseUrl()}${FrontendApiRoutes.VERSION_PREFIX}`;
      const normalizedPath = FrontendApiRoutes.normalizeResourcePath(path, '/');
      const url = new URL(`${apiPrefix}${normalizedPath}`);

      if (query && typeof query === 'object') {
        for (const [key, value] of Object.entries(query)) {
          if (value === null || value === undefined || value === '') continue;
          url.searchParams.set(key, String(value));
        }
      }

      return url.toString();

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static normalizeResourcePath(path: unknown, fallback = '/'): string {
    const raw = String(path || '').trim();
    if (!raw) return fallback;
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}