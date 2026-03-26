import { ApiPathUtils, ApiVersionUtils, RouteConstants, SystemConstants } from '@fromcode119/core';

/**
 * API Configuration Singleton.
 * 
 * Provides centralized access to all API-related configuration:
 * - API routes and prefixes
 * - Storage configuration
 * - Reserved permalinks
 * - Route helpers
 * 
 * Replaces scattered constant exports with a single, type-safe configuration class.
 * 
 * @example
 * ```typescript
 * import { ApiConfig } from '@fromcode119/api';
 * 
 * const config = ApiConfig.getInstance();
 * const loginRoute = config.routes.auth.LOGIN;
 * const versionedPrefix = config.prefixes.VERSIONED;
 * const isReserved = config.isReservedPermalink('/api');
 * ```
 */
export class ApiConfig {
  private static instance: ApiConfig | null = null;

  private constructor() {}

  /**
   * Get the singleton instance.
   */
  static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }

  /**
   * API version (extracted from environment or package.json).
   */
  get version(): string {
    return ApiVersionUtils.normalize();
  }

  /**
   * API route prefixes.
   */
  get prefixes() {
    return {
      BASE: '/api' as const,
      get VERSIONED() { return ApiVersionUtils.prefix(); }
    };
  }

  /**
   * Root-level probe routes for infrastructure health checks.
   */
  get probeRoutes() {
    return {
      HEALTH: RouteConstants.SEGMENTS.HEALTH,
      READY: RouteConstants.SEGMENTS.READY,
    } as const;
  }

  /**
   * Reserved permalink paths that cannot be used as content slugs.
   */
  get reservedPermalinks() {
    return {
      ROOT_SEGMENTS: [
        'api',
        'admin',
        'plugins',
        'themes',
        'media',
        'uploads',
        'auth',
        'login',
        'logout',
        'register',
        'setup',
        '_next',
        '_system',
        'socket',
        this.probeRoutes.HEALTH.replace(/^\//, ''),
        'graphql',
        'favicon.ico',
        'robots.txt',
        'sitemap.xml'
      ] as const,
      EXACT_PATHS: [
        '/',
        this.probeRoutes.HEALTH,
        '/openapi.json'
      ] as const
    } as const;
  }

  /**
   * Check if a path is a reserved permalink.
   */
  isReservedPermalink(path: string): boolean {
    const normalized = path.toLowerCase().trim();
    
    // Check exact paths
    if (this.reservedPermalinks.EXACT_PATHS.includes(normalized as any)) {
      return true;
    }

    // Check root segments
    const firstSegment = normalized.split('/').filter(Boolean)[0];
    if (firstSegment && this.reservedPermalinks.ROOT_SEGMENTS.includes(firstSegment as any)) {
      return true;
    }

    return false;
  }

  /**
   * Storage configuration.
   */
  get storage() {
    return SystemConstants.STORAGE;
  }

  /**
   * Public route prefixes.
   */
  get publicRoutePrefixes() {
    return SystemConstants.PUBLIC_ROUTE_PREFIXES;
  }

  /**
   * Versioned API routes.
   */
  get routes() {
    const withVersion = (path: unknown) => `${this.prefixes.VERSIONED}${this.normalizePath(path, '/')}`;
    const withoutVersion = (path: unknown) => `${this.prefixes.BASE}${this.normalizePath(path, '/')}`;

    return {
      auth: {
        STATUS: withVersion(SystemConstants.API_PATH.AUTH.STATUS),
        SETUP: withVersion(SystemConstants.API_PATH.AUTH.SETUP),
        REGISTER: withVersion(SystemConstants.API_PATH.AUTH.REGISTER),
        VERIFY_EMAIL: withVersion(SystemConstants.API_PATH.AUTH.VERIFY_EMAIL),
        RESEND_VERIFICATION: withVersion(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION),
        FORGOT_PASSWORD: withVersion(SystemConstants.API_PATH.AUTH.FORGOT_PASSWORD),
        RESET_PASSWORD: withVersion(SystemConstants.API_PATH.AUTH.RESET_PASSWORD),
        VERIFY_PASSWORD: withVersion(SystemConstants.API_PATH.AUTH.VERIFY_PASSWORD),
        CHANGE_PASSWORD: withVersion(SystemConstants.API_PATH.AUTH.CHANGE_PASSWORD),
        SECURITY: withVersion(SystemConstants.API_PATH.AUTH.SECURITY),
        EMAIL_CHANGE_REQUEST: withVersion(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_REQUEST),
        EMAIL_CHANGE_CONFIRM: withVersion(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_CONFIRM),
        SSO_PROVIDERS: withVersion(SystemConstants.API_PATH.AUTH.SSO_PROVIDERS),
        SSO_LOGIN: withVersion(SystemConstants.API_PATH.AUTH.SSO_LOGIN),
        LOGIN: withVersion(SystemConstants.API_PATH.AUTH.LOGIN),
        LOGOUT: withVersion(SystemConstants.API_PATH.AUTH.LOGOUT),
        SESSIONS: withVersion(SystemConstants.API_PATH.AUTH.SESSIONS),
        MY_SESSIONS: withVersion(SystemConstants.API_PATH.AUTH.MY_SESSIONS),
        REVOKE_MY_SESSION: (id: string) => withVersion(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.REVOKE_SESSION, { id })),
        REVOKE_OTHER_SESSIONS: withVersion(SystemConstants.API_PATH.AUTH.REVOKE_OTHER_SESSIONS),
        KILL_SESSION: (id: string) => withVersion(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.KILL_SESSION, { id })),
        API_TOKENS: withVersion(SystemConstants.API_PATH.AUTH.API_TOKENS),
        API_TOKEN: (id: string) => withVersion(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.API_TOKEN, { id })),
      },
      plugins: {
        BASE: withVersion(SystemConstants.API_PATH.PLUGINS.BASE),
        ACTIVE: withVersion(SystemConstants.API_PATH.PLUGINS.ACTIVE),
        TOGGLE: (slug: string) => withVersion(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.TOGGLE, { slug })),
        CONFIG: (slug: string) => withVersion(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.CONFIG, { slug })),
        SAVE_CONFIG: (slug: string) => withVersion(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.CONFIG, { slug })),
        DELETE: (slug: string) => withVersion(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.DELETE, { slug })),
        MARKETPLACE: withVersion(SystemConstants.API_PATH.PLUGINS.MARKETPLACE),
        INSTALL: (slug: string) => withVersion(`${SystemConstants.API_PATH.PLUGINS.INSTALL}/${slug}`),
        UI: SystemConstants.API_PATH.PLUGINS.UI,
      },
      system: {
        ADMIN_PLUGINS: withVersion(SystemConstants.API_PATH.SYSTEM.ADMIN_PLUGINS),
        ADMIN_STATS: withVersion(SystemConstants.API_PATH.SYSTEM.ADMIN_STATS),
        HEALTH: withVersion(SystemConstants.API_PATH.SYSTEM.HEALTH),
        STATUS: withVersion(SystemConstants.API_PATH.SYSTEM.STATUS),
        OPENAPI: withVersion(SystemConstants.API_PATH.SYSTEM.OPENAPI),
        I18N: withVersion(SystemConstants.API_PATH.SYSTEM.I18N),
        EVENTS: withVersion(SystemConstants.API_PATH.SYSTEM.EVENTS),
      },
      collections: {
        BASE: withVersion(SystemConstants.API_PATH.COLLECTIONS.BASE),
        ITEM: withVersion(SystemConstants.API_PATH.COLLECTIONS.ITEM),
        DETAIL: withVersion(SystemConstants.API_PATH.COLLECTIONS.DETAIL),
      }
    };
  }

  /**
   * Application (frontend) routes.
   */
  get appRoutes() {
    return {
      auth: SystemConstants.APP_PATH.AUTH,
      admin: SystemConstants.APP_PATH.ADMIN,
    } as const;
  }

  /**
   * Helper: Normalize a route path.
   */
  private normalizePath(path: unknown, fallback: string): string {
    const value = String(path || '').trim();
    if (!value) return fallback;
    return value.startsWith('/') ? value : `/${value}`;
  }

  /**
   * Helper: Get API version prefix dynamically.
   */
  getApiVersionPrefix(): string {
    return ApiVersionUtils.prefix();
  }

  /**
   * Helper: Resolve storage public URL base.
   */
  resolveStoragePublicUrlBase(rawValue?: string): string {
    const value = rawValue || process.env.STORAGE_PUBLIC_URL;
    return this.resolveStorageBase(value, this.storage.DEFAULT_PUBLIC_URL);
  }

  /**
   * Helper: Resolve storage public path.
   */
  resolveStoragePublicPath(rawValue?: string): string {
    const value = rawValue || process.env.STORAGE_PUBLIC_URL;
    return this.resolveStoragePath(value, this.storage.DEFAULT_PUBLIC_URL);
  }

  /**
   * Internal: Resolve storage URL base.
   */
  private resolveStorageBase(rawValue: string | undefined, fallback: string): string {
    const value = String(rawValue || '').trim();
    if (!value || value === '/') return fallback;
    
    // Remove trailing slash
    const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
    
    // If it's a full URL, return as-is
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }
    
    // If it's a path, ensure leading slash
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  /**
   * Internal: Resolve storage public path.
   */
  private resolveStoragePath(rawValue: string | undefined, fallback: string): string {
    const base = this.resolveStorageBase(rawValue, fallback);
    
    // If it's a full URL, extract the path
    if (base.startsWith('http://') || base.startsWith('https://')) {
      try {
        const url = new URL(base);
        return url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
      } catch {
        return fallback;
      }
    }
    
    return base;
  }
}
