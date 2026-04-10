import { RouteConstants, SystemConstants } from '@fromcode119/core';

export class AdminBootstrapRateLimitUtils {
  static readonly AUTH_STATUS_PATH = SystemConstants.API_PATH.AUTH.STATUS;
  static readonly SYSTEM_INTEGRATIONS_PATH = `${SystemConstants.API_PATH.SYSTEM.BASE}${RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS}`;
  static readonly RESERVED_TOP_LEVEL_SEGMENTS = [
    AdminBootstrapRateLimitUtils.stripLeadingSlash(RouteConstants.SEGMENTS.AUTH),
    AdminBootstrapRateLimitUtils.stripLeadingSlash(RouteConstants.SEGMENTS.SYSTEM),
    AdminBootstrapRateLimitUtils.stripLeadingSlash(RouteConstants.SEGMENTS.PLUGINS),
    AdminBootstrapRateLimitUtils.stripLeadingSlash(RouteConstants.SEGMENTS.THEMES),
    AdminBootstrapRateLimitUtils.stripLeadingSlash(RouteConstants.SEGMENTS.MEDIA),
    AdminBootstrapRateLimitUtils.stripLeadingSlash(RouteConstants.SEGMENTS.VERSIONS),
  ] as const;
  static readonly BOOTSTRAP_GROUP_RULES = [
    {
      group: 'auth-status',
      pattern: new RegExp(`${AdminBootstrapRateLimitUtils.escapeForRegExp(AdminBootstrapRateLimitUtils.AUTH_STATUS_PATH)}$`),
    },
    {
      group: 'system-integrations',
      pattern: new RegExp(`(^|\\/)${AdminBootstrapRateLimitUtils.escapeForRegExp(AdminBootstrapRateLimitUtils.stripLeadingSlash(AdminBootstrapRateLimitUtils.SYSTEM_INTEGRATIONS_PATH))}(?:\\/|$)`),
    },
  ] as const;

  static resolveKey(requestLike: {
    ip?: unknown;
    method?: unknown;
    headers?: Record<string, unknown>;
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
  }): string {
    const clientKey = AdminBootstrapRateLimitUtils.resolveClientKey(requestLike.ip);
    const bootstrapGroup = AdminBootstrapRateLimitUtils.resolveBootstrapGroup(requestLike);
    return bootstrapGroup ? `admin-bootstrap:${clientKey}:${bootstrapGroup}` : `ip:${clientKey}`;
  }

  static isAdminBootstrapRead(requestLike: {
    method?: unknown;
    headers?: Record<string, unknown>;
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
  }): boolean {
    return Boolean(AdminBootstrapRateLimitUtils.resolveBootstrapGroup(requestLike));
  }

  private static resolveBootstrapGroup(requestLike: {
    method?: unknown;
    headers?: Record<string, unknown>;
    originalUrl?: unknown;
    url?: unknown;
    path?: unknown;
    baseUrl?: unknown;
  }): string {
    if (!AdminBootstrapRateLimitUtils.isReadOnlyMethod(requestLike.method)) {
      return '';
    }

    if (!AdminBootstrapRateLimitUtils.isAdminClient(requestLike.headers)) {
      return '';
    }

    const matchedPath = AdminBootstrapRateLimitUtils.readPathCandidates(requestLike)
      .find((path) => AdminBootstrapRateLimitUtils.isAdminBootstrapPath(path));

    if (!matchedPath) {
      return '';
    }

    const matchedGroup = AdminBootstrapRateLimitUtils.BOOTSTRAP_GROUP_RULES.find((rule) => rule.pattern.test(matchedPath));
    if (matchedGroup) {
      return matchedGroup.group;
    }

    if (AdminBootstrapRateLimitUtils.isExtensionAdminBootstrapPath(matchedPath)) {
      return 'extension-admin';
    }

    return 'admin-bootstrap';
  }

  private static isReadOnlyMethod(method: unknown): boolean {
    const normalizedMethod = String(method || 'GET').trim().toUpperCase();
    return normalizedMethod === 'GET' || normalizedMethod === 'HEAD';
  }

  private static isAdminClient(headers?: Record<string, unknown>): boolean {
    return String(headers?.['x-framework-client'] || '').trim().toLowerCase() === 'admin-ui';
  }

  private static isAdminBootstrapPath(path: string): boolean {
    return AdminBootstrapRateLimitUtils.BOOTSTRAP_GROUP_RULES.some((rule) => rule.pattern.test(path))
      || AdminBootstrapRateLimitUtils.isExtensionAdminBootstrapPath(path);
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

  private static resolveClientKey(ip: unknown): string {
    const normalizedIp = String(ip || '').trim();
    return normalizedIp || 'unknown';
  }

  private static stripLeadingSlash(value: string): string {
    return value.replace(/^\/+/, '');
  }

  private static escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static isExtensionAdminBootstrapPath(path: string): boolean {
    const pathSegments = AdminBootstrapRateLimitUtils.normalizePath(path)
      .split('/')
      .filter(Boolean)
      .map((segment) => String(segment || '').trim().toLowerCase());
    const adminSegment = AdminBootstrapRateLimitUtils.stripLeadingSlash(RouteConstants.SEGMENTS.ADMIN_BASE);
    const adminIndex = pathSegments.findIndex((segment, index) => {
      if (segment !== adminSegment || index === 0) {
        return false;
      }

      const ownerSegment = pathSegments[index - 1];
      return Boolean(ownerSegment)
        && !AdminBootstrapRateLimitUtils.isVersionLikeSegment(ownerSegment)
        && !AdminBootstrapRateLimitUtils.RESERVED_TOP_LEVEL_SEGMENTS.includes(ownerSegment as typeof AdminBootstrapRateLimitUtils.RESERVED_TOP_LEVEL_SEGMENTS[number]);
    });

    return adminIndex > 0;
  }

  private static isVersionLikeSegment(segment: string): boolean {
    return /^v\d+$/i.test(String(segment || '').trim());
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
}
