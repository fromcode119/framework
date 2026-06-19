import { ApiPathUtils } from './api/api-path-utils';
import { ApplicationUrlUtils } from './application-url-utils';
import { ApiVersionUtils } from './api-version';
import { AppPathConstants } from './app-path-constants';
import { RequestSurfaceHelper } from './request-surface-helper';
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
      RequestSurfaceHelper.readHeader,
      RequestSurfaceHelper.readAbsoluteUrl,
      RequestSurfaceUtils.isAdminAbsoluteUrl,
    )) {
      return true;
    }
    if (RequestSurfaceOriginUtils.hasFrontendOriginSignal(
      requestLike,
      RequestSurfaceHelper.readHeader,
      RequestSurfaceHelper.readAbsoluteUrl,
      RequestSurfaceUtils.isFrontendAbsoluteUrl,
    )) {
      return false;
    }

    return RequestSurfaceHelper.readPathCandidates(requestLike)
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
      RequestSurfaceHelper.readHeader,
      RequestSurfaceHelper.readAbsoluteUrl,
      RequestSurfaceUtils.isFrontendAbsoluteUrl,
    )) {
      return true;
    }
    if (RequestSurfaceOriginUtils.hasAdminOriginSignal(
      requestLike,
      RequestSurfaceHelper.readHeader,
      RequestSurfaceHelper.readAbsoluteUrl,
      RequestSurfaceUtils.isAdminAbsoluteUrl,
    )) {
      return false;
    }

    return RequestSurfaceHelper.readPathCandidates(requestLike)
      .some((path) => RequestSurfaceUtils.isFrontendPath(path));
  }

  static isAdminPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceHelper.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    const unversionedPath = RequestSurfaceHelper.stripApiVersionPrefix(normalizedPath);
    return RequestSurfaceHelper.hasPathPrefix(normalizedPath, RequestSurfaceUtils.ADMIN_BASE_PATH)
      || RequestSurfaceHelper.hasPathPrefix(normalizedPath, RequestSurfaceUtils.ADMIN_API_BASE_PATH)
      || RequestSurfaceHelper.hasPathPrefix(unversionedPath, RequestSurfaceUtils.ADMIN_SYSTEM_BASE_PATH)
      || RequestSurfaceUtils.isExtensionAdminApiPath(unversionedPath);
  }

  static isApiPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceHelper.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    if (RequestSurfaceHelper.hasPathPrefix(normalizedPath, ApiVersionUtils.API_BASE_PATH)) {
      return true;
    }

    const unversionedPath = RequestSurfaceHelper.stripApiVersionPrefix(normalizedPath);
    return RequestSurfaceUtils.API_BASE_PATHS.some((prefix) => (
      RequestSurfaceHelper.hasPathPrefix(normalizedPath, prefix)
      || RequestSurfaceHelper.hasPathPrefix(unversionedPath, prefix)
    )) || RequestSurfaceUtils.isExtensionAdminApiPath(unversionedPath);
  }

  static isFrontendPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceHelper.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    if (RequestSurfaceUtils.isAdminPath(normalizedPath) || RequestSurfaceUtils.isApiPath(normalizedPath)) {
      return false;
    }

    return normalizedPath.startsWith('/');
  }

  static isExtensionAdminPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceHelper.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    return RequestSurfaceUtils.isExtensionAdminApiPath(
      RequestSurfaceHelper.stripApiVersionPrefix(normalizedPath),
    );
  }

  static readRefererUrl(requestLike: {
    headers?: Record<string, unknown>;
    get?: (name: string) => string | undefined;
  }): URL | null {
    return RequestSurfaceHelper.readAbsoluteUrl(
      RequestSurfaceHelper.readHeader(requestLike, 'referer'),
    );
  }

  private static readClientHeader(requestLike: {
    headers?: Record<string, unknown>;
    get?: (name: string) => string | undefined;
  }): string {
    return String(
      RequestSurfaceHelper.readHeader(requestLike, RequestSurfaceUtils.CLIENT_HEADER) || '',
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
    return RequestSurfaceHelper.readAbsoluteUrl(
      process.env.ADMIN_URL || '',
    );
  }

  private static matchesAbsoluteUrl(candidate: URL, target: URL): boolean {
    return candidate.origin === target.origin
      && RequestSurfaceHelper.hasPathPrefix(candidate.pathname, target.pathname || '/');
  }

  private static isExtensionAdminApiPath(value: unknown): boolean {
    const normalizedPath = RequestSurfaceHelper.normalizePathname(value);
    if (!normalizedPath) {
      return false;
    }

    const normalizedAdminBasePath = RequestSurfaceHelper.normalizePathname(RequestSurfaceUtils.ADMIN_BASE_PATH);
    const adminSegment = normalizedAdminBasePath.startsWith('/')
      ? normalizedAdminBasePath.slice(1)
      : normalizedAdminBasePath;
    const pathSegments = normalizedPath.split('/').filter(Boolean);

    return Boolean(adminSegment)
      && pathSegments.length >= 2
      && pathSegments[1] === adminSegment;
  }
}
