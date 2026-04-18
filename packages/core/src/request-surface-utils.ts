import { ApiPathUtils } from './api/api-path-utils';
import { ApplicationUrlUtils } from './application-url-utils';
import { ApiVersionUtils } from './api-version';
import { AppPathConstants } from './app-path-constants';
import { RequestSurfaceOriginUtils } from './request-surface-origin-utils';
import { RouteConstants } from './route-constants';
import { SystemConstants } from './constants';

export class RequestSurfaceUtils {
  static readonly CLIENT_HEADER = 'x-framework-client';

  static readonly CLIENTS = {
    ADMIN_UI: 'admin-ui',
    FRONTEND_UI: 'frontend-ui',
  } as const;

  static get ADMIN_BASE_PATH(): string {
    return ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.ADMIN_APP)
      || AppPathConstants.ADMIN.ADMIN.BASE;
  }

  static readonly ADMIN_SYSTEM_BASE_PATH = `${SystemConstants.API_PATH.SYSTEM.BASE}${RouteConstants.SEGMENTS.ADMIN_BASE}`;

  static get ADMIN_API_BASE_PATH(): string {
    return ApiPathUtils.adminApiBasePath();
  }

  static get API_BASE_PATHS(): string[] {
    return [
      RouteConstants.SEGMENTS.AUTH,
      RouteConstants.SEGMENTS.SYSTEM,
      RouteConstants.SEGMENTS.PLUGINS,
      RouteConstants.SEGMENTS.THEMES,
      RouteConstants.SEGMENTS.MEDIA,
      SystemConstants.STORAGE.DEFAULT_PUBLIC_URL,
      RouteConstants.SEGMENTS.VERSIONS,
      RequestSurfaceUtils.ADMIN_API_BASE_PATH,
    ];
  }

  static isAdminRequestContext(requestLike: {
    headers?: Record<string, unknown>;
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
    get?: (name: string) => string | undefined;
  }): boolean {
    const client = RequestSurfaceUtils.readClientHeader(requestLike);
    if (client === RequestSurfaceUtils.CLIENTS.ADMIN_UI) {
      return true;
    }
    if (client === RequestSurfaceUtils.CLIENTS.FRONTEND_UI) {
      return false;
    }

    if (RequestSurfaceOriginUtils.hasAdminOriginSignal(
      requestLike,
      RequestSurfaceUtils.readHeader,
      RequestSurfaceUtils.readAbsoluteUrl,
      RequestSurfaceUtils.isAdminAbsoluteUrl,
    )) {
      return true;
    }
    if (RequestSurfaceOriginUtils.hasFrontendOriginSignal(
      requestLike,
      RequestSurfaceUtils.readHeader,
      RequestSurfaceUtils.readAbsoluteUrl,
      RequestSurfaceUtils.isFrontendAbsoluteUrl,
    )) {
      return false;
    }

    return RequestSurfaceUtils.readPathCandidates(requestLike)
      .some((path) => RequestSurfaceUtils.isAdminPath(path));
  }

  static isFrontendRequestContext(requestLike: {
    headers?: Record<string, unknown>;
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
    get?: (name: string) => string | undefined;
  }): boolean {
    const client = RequestSurfaceUtils.readClientHeader(requestLike);
    if (client === RequestSurfaceUtils.CLIENTS.FRONTEND_UI) {
      return true;
    }
    if (client === RequestSurfaceUtils.CLIENTS.ADMIN_UI) {
      return false;
    }

    if (RequestSurfaceOriginUtils.hasFrontendOriginSignal(
      requestLike,
      RequestSurfaceUtils.readHeader,
      RequestSurfaceUtils.readAbsoluteUrl,
      RequestSurfaceUtils.isFrontendAbsoluteUrl,
    )) {
      return true;
    }
    if (RequestSurfaceOriginUtils.hasAdminOriginSignal(
      requestLike,
      RequestSurfaceUtils.readHeader,
      RequestSurfaceUtils.readAbsoluteUrl,
      RequestSurfaceUtils.isAdminAbsoluteUrl,
    )) {
      return false;
    }

    return RequestSurfaceUtils.readPathCandidates(requestLike)
      .some((path) => RequestSurfaceUtils.isFrontendPath(path));
  }

  static isAdminPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceUtils.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    const unversionedPath = RequestSurfaceUtils.stripApiVersionPrefix(normalizedPath);
    return RequestSurfaceUtils.hasPathPrefix(normalizedPath, RequestSurfaceUtils.ADMIN_BASE_PATH)
      || RequestSurfaceUtils.hasPathPrefix(normalizedPath, RequestSurfaceUtils.ADMIN_API_BASE_PATH)
      || RequestSurfaceUtils.hasPathPrefix(unversionedPath, RequestSurfaceUtils.ADMIN_SYSTEM_BASE_PATH)
      || RequestSurfaceUtils.isExtensionAdminApiPath(unversionedPath);
  }

  static isApiPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceUtils.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    if (RequestSurfaceUtils.hasPathPrefix(normalizedPath, ApiVersionUtils.API_BASE_PATH)) {
      return true;
    }

    const unversionedPath = RequestSurfaceUtils.stripApiVersionPrefix(normalizedPath);
    return RequestSurfaceUtils.API_BASE_PATHS.some((prefix) => (
      RequestSurfaceUtils.hasPathPrefix(normalizedPath, prefix)
      || RequestSurfaceUtils.hasPathPrefix(unversionedPath, prefix)
    )) || RequestSurfaceUtils.isExtensionAdminApiPath(unversionedPath);
  }

  static isFrontendPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceUtils.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    if (RequestSurfaceUtils.isAdminPath(normalizedPath) || RequestSurfaceUtils.isApiPath(normalizedPath)) {
      return false;
    }

    return normalizedPath.startsWith('/');
  }

  static isExtensionAdminPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceUtils.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    return RequestSurfaceUtils.isExtensionAdminApiPath(
      RequestSurfaceUtils.stripApiVersionPrefix(normalizedPath),
    );
  }

  static readRefererUrl(requestLike: {
    headers?: Record<string, unknown>;
    get?: (name: string) => string | undefined;
  }): URL | null {
    return RequestSurfaceUtils.readAbsoluteUrl(
      RequestSurfaceUtils.readHeader(requestLike, 'referer'),
    );
  }

  private static readClientHeader(requestLike: {
    headers?: Record<string, unknown>;
    get?: (name: string) => string | undefined;
  }): string {
    return String(
      RequestSurfaceUtils.readHeader(requestLike, RequestSurfaceUtils.CLIENT_HEADER) || '',
    ).trim().toLowerCase();
  }

  private static isAdminAbsoluteUrl(url: URL): boolean {
    const configuredAdminUrl = RequestSurfaceUtils.readConfiguredAdminUrl();
    if (configuredAdminUrl && RequestSurfaceUtils.matchesAbsoluteUrl(url, configuredAdminUrl)) {
      return true;
    }

    return ApplicationUrlUtils.hasHostRole(url, ApplicationUrlUtils.ADMIN_APP)
      || RequestSurfaceUtils.isAdminPath(url.pathname);
  }

  private static isFrontendAbsoluteUrl(url: URL): boolean {
    if (RequestSurfaceUtils.isAdminAbsoluteUrl(url)) {
      return false;
    }

    const hostRole = ApplicationUrlUtils.detectHostRole(url);
    if (hostRole === ApplicationUrlUtils.API_APP) {
      return false;
    }
    if (hostRole === ApplicationUrlUtils.FRONTEND_APP) {
      return true;
    }

    return RequestSurfaceUtils.isFrontendPath(url.pathname);
  }

  private static readConfiguredAdminUrl(): URL | null {
    return RequestSurfaceUtils.readAbsoluteUrl(
      process.env.ADMIN_URL || '',
    );
  }

  private static matchesAbsoluteUrl(candidate: URL, target: URL): boolean {
    return candidate.origin === target.origin
      && RequestSurfaceUtils.hasPathPrefix(candidate.pathname, target.pathname || '/');
  }

  private static isExtensionAdminApiPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceUtils.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    const normalizedAdminBasePath = RequestSurfaceUtils.normalizePathname(RequestSurfaceUtils.ADMIN_BASE_PATH);
    const adminSegment = normalizedAdminBasePath.startsWith('/')
      ? normalizedAdminBasePath.slice(1)
      : normalizedAdminBasePath;
    const pathSegments = normalizedPath.split('/').filter(Boolean);

    return Boolean(adminSegment)
      && pathSegments.length >= 2
      && pathSegments[1] === adminSegment;
  }

  private static readPathCandidates(requestLike: {
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
      RequestSurfaceUtils.readHeader(requestLike, 'x-original-uri'),
      RequestSurfaceUtils.readHeader(requestLike, 'x-rewrite-url'),
      RequestSurfaceUtils.readHeader(requestLike, 'referer'),
    ];

    const seen = new Set<string>();
    const paths: string[] = [];
    for (const value of values) {
      const normalizedPath = RequestSurfaceUtils.normalizePathname(value);
      if (!normalizedPath || seen.has(normalizedPath)) {
        continue;
      }
      seen.add(normalizedPath);
      paths.push(normalizedPath);
    }

    return paths;
  }

  private static readHeader(requestLike: {
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

  private static normalizePathname(value: unknown): string {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      return '';
    }

    try {
      const parsedUrl = new URL(normalizedValue);
      return RequestSurfaceUtils.normalizePathname(parsedUrl.pathname);
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

  private static stripApiVersionPrefix(pathname: string): string {
    const normalizedPath = RequestSurfaceUtils.normalizePathname(pathname);
    if (!normalizedPath) {
      return '';
    }

    if (!RequestSurfaceUtils.hasPathPrefix(normalizedPath, ApiVersionUtils.API_BASE_PATH)) {
      return normalizedPath;
    }

    const withoutApiBase = normalizedPath.slice(ApiVersionUtils.API_BASE_PATH.length) || '/';
    const matchedVersion = withoutApiBase.match(/^\/v[^/]+(?=\/|$)/i);
    if (!matchedVersion) {
      return RequestSurfaceUtils.normalizePathname(withoutApiBase);
    }

    const withoutVersion = withoutApiBase.slice(matchedVersion[0].length) || '/';
    return RequestSurfaceUtils.normalizePathname(withoutVersion);
  }

  private static hasPathPrefix(pathname: string, prefix: string): boolean {
    const normalizedPath = RequestSurfaceUtils.normalizePathname(pathname);
    const normalizedPrefix = RequestSurfaceUtils.normalizePathname(prefix);
    if (!normalizedPath || !normalizedPrefix) {
      return false;
    }
    if (normalizedPath === normalizedPrefix) {
      return true;
    }
    return normalizedPath.startsWith(`${normalizedPrefix}/`);
  }

  private static readAbsoluteUrl(value: unknown): URL | null {
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
}
