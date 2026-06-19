import { ApiVersionUtils } from './api-version';

/**
 * Internal helpers for {@link RequestSurfaceUtils} — header/path normalization and
 * absolute-url parsing. Not part of the public surface; the public façade delegates
 * here so behavior stays identical.
 */
export class RequestSurfaceHelper {
  static readHeader(requestLike: {
    headers?: Record<string, unknown>;
    get?: (name: string) => string | undefined;
  }, headerName: string): string {
    const directGetter = typeof requestLike.get === 'function'
      ? requestLike.get(headerName)
      : undefined;
    if (directGetter) {
      return String(directGetter).trim();
    }

    const headers = requestLike.headers || {};
    const directValue = headers[headerName];
    if (typeof directValue === 'string') {
      return directValue.trim();
    }

    const lowercaseValue = headers[headerName.toLowerCase()];
    return typeof lowercaseValue === 'string'
      ? lowercaseValue.trim()
      : '';
  }

  static normalizePathname(value: unknown): string {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return '';
    }

    try {
      const parsedUrl = new URL(normalizedValue);
      return RequestSurfaceHelper.normalizePathname(parsedUrl.pathname);
    } catch {}

    const withoutQueryOrHash = normalizedValue.split('?')[0].split('#')[0].trim();
    if (!withoutQueryOrHash) {
      return '';
    }

    const withLeadingSlash = withoutQueryOrHash.startsWith('/')
      ? withoutQueryOrHash
      : `/${withoutQueryOrHash}`;
    const compacted = withLeadingSlash.replace(/\/{2,}/g, '/');
    if (compacted.length === 1) {
      return compacted;
    }

    return compacted.replace(/\/+$/, '');
  }

  static stripApiVersionPrefix(pathname: string): string {
    const normalizedPath = RequestSurfaceHelper.normalizePathname(pathname);
    if (!normalizedPath) {
      return '';
    }

    if (!RequestSurfaceHelper.hasPathPrefix(normalizedPath, ApiVersionUtils.API_BASE_PATH)) {
      return normalizedPath;
    }

    const withoutApiBase = normalizedPath.slice(ApiVersionUtils.API_BASE_PATH.length) || '/';
    const matchedVersion = withoutApiBase.match(/^\/v[^/]+(?=\/|$)/i);
    if (!matchedVersion) {
      return RequestSurfaceHelper.normalizePathname(withoutApiBase);
    }

    const withoutVersion = withoutApiBase.slice(matchedVersion[0].length) || '/';
    return RequestSurfaceHelper.normalizePathname(withoutVersion);
  }

  static hasPathPrefix(pathname: string, prefix: string): boolean {
    const normalizedPath = RequestSurfaceHelper.normalizePathname(pathname);
    const normalizedPrefix = RequestSurfaceHelper.normalizePathname(prefix);
    if (!normalizedPath || !normalizedPrefix) {
      return false;
    }
    if (normalizedPath === normalizedPrefix) {
      return true;
    }
    return normalizedPath.startsWith(`${normalizedPrefix}/`);
  }

  static readAbsoluteUrl(value: unknown): URL | null {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return null;
    }

    try {
      return new URL(normalizedValue);
    } catch {
      return null;
    }
  }

  static readPathCandidates(requestLike: {
    headers?: Record<string, unknown>;
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
    get?: (name: string) => string | undefined;
  }): string[] {
    const values = [
      requestLike.originalUrl,
      requestLike.url,
      requestLike.baseUrl,
      requestLike.path,
      RequestSurfaceHelper.readHeader(requestLike, 'x-original-uri'),
      RequestSurfaceHelper.readHeader(requestLike, 'x-rewrite-url'),
      RequestSurfaceHelper.readHeader(requestLike, 'referer'),
    ];

    const seen = new Set<string>();
    const paths: string[] = [];
    for (const value of values) {
      const normalizedPath = RequestSurfaceHelper.normalizePathname(value);
      if (!normalizedPath || seen.has(normalizedPath)) {
        continue;
      }
      seen.add(normalizedPath);
      paths.push(normalizedPath);
    }

    return paths;
  }
}
