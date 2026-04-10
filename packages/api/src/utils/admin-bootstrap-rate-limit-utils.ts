import { AppPathConstants, RequestSurfaceUtils, SystemConstants } from '@fromcode119/core';
import { PublicSystemRouteUtils } from './public-system-route-utils';

export class AdminBootstrapRateLimitUtils {
  static readonly ADMIN_SYSTEM_BASE_PATH = `${SystemConstants.API_PATH.SYSTEM.BASE}${AppPathConstants.ADMIN.ADMIN.BASE}`;

  static shouldBypass(requestLike: {
    method?: unknown;
    headers?: Record<string, unknown>;
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
    get?: (name: string) => string | undefined;
  }): boolean {
    const paths = AdminBootstrapRateLimitUtils.readPathCandidates(requestLike);
    if (paths.some((path) => PublicSystemRouteUtils.isRateLimitBypassPath(path))) {
      return true;
    }

    if (!AdminBootstrapRateLimitUtils.isReadOnlyMethod(requestLike.method)) {
      return false;
    }

    if (!RequestSurfaceUtils.isAdminRequestContext(requestLike)) {
      return false;
    }

    return paths.some((path) => AdminBootstrapRateLimitUtils.isAdminBootstrapPath(path));
  }

  private static isReadOnlyMethod(method: unknown): boolean {
    const normalizedMethod = String(method || 'GET').trim().toUpperCase();
    return normalizedMethod === 'GET' || normalizedMethod === 'HEAD';
  }

  private static isAdminBootstrapPath(path: string): boolean {
    const normalizedPath = AdminBootstrapRateLimitUtils.normalizePath(path);
    const unversionedPath = AdminBootstrapRateLimitUtils.stripVersionPrefix(normalizedPath);

    return AdminBootstrapRateLimitUtils.hasPathSuffix(unversionedPath, SystemConstants.API_PATH.AUTH.STATUS)
      || AdminBootstrapRateLimitUtils.hasPathPrefix(unversionedPath, AdminBootstrapRateLimitUtils.ADMIN_SYSTEM_BASE_PATH)
      || RequestSurfaceUtils.isExtensionAdminPath(unversionedPath);
  }

  private static readPathCandidates(requestLike: {
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
  }): string[] {
    return [
      requestLike.originalUrl,
      requestLike.url,
      requestLike.path,
      requestLike.baseUrl,
    ]
      .map((value) => AdminBootstrapRateLimitUtils.normalizePath(value))
      .filter(Boolean);
  }

  private static normalizePath(value: unknown): string {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return '';
    }

    try {
      if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
        return new URL(rawValue).pathname || '';
      }
    } catch {
      return '';
    }

    return rawValue.split('?')[0]?.split('#')[0]?.trim() || '';
  }

  private static hasPathPrefix(path: string, prefix: string): boolean {
    const normalizedPath = AdminBootstrapRateLimitUtils.normalizePath(path);
    const normalizedPrefix = AdminBootstrapRateLimitUtils.normalizePath(prefix);
    if (!normalizedPath || !normalizedPrefix) {
      return false;
    }

    return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
  }

  private static hasPathSuffix(path: string, suffix: string): boolean {
    const normalizedPath = AdminBootstrapRateLimitUtils.normalizePath(path);
    const normalizedSuffix = AdminBootstrapRateLimitUtils.normalizePath(suffix);
    if (!normalizedPath || !normalizedSuffix) {
      return false;
    }

    return normalizedPath === normalizedSuffix || normalizedPath.endsWith(normalizedSuffix);
  }

  private static stripVersionPrefix(path: string): string {
    const normalizedPath = AdminBootstrapRateLimitUtils.normalizePath(path);
    if (!normalizedPath) {
      return '';
    }

    return normalizedPath
      .replace(/^\/api\/v[^/]+(?=\/|$)/i, '')
      .replace(/^\/v[^/]+(?=\/|$)/i, '') || '/';
  }
}
