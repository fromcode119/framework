import { API_RESOURCE_PATHS, buildApiVersionPrefix, normalizeApiVersion } from '@fromcode/core/utils';
import { resolveFrontendApiBaseUrl } from './api-base-url';

export const FRONTEND_API_VERSION = normalizeApiVersion();
export const FRONTEND_API_VERSION_PREFIX = buildApiVersionPrefix();

function normalizeResourcePath(path: unknown, fallback = '/'): string {
  const raw = String(path || '').trim();
  if (!raw) return fallback;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function buildFrontendApiUrl(path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
  const apiPrefix = `${resolveFrontendApiBaseUrl()}${FRONTEND_API_VERSION_PREFIX}`;
  const normalizedPath = normalizeResourcePath(path, '/');
  const url = new URL(`${apiPrefix}${normalizedPath}`);

  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}
