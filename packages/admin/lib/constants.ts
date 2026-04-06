import { ApiPathUtils, ApiVersionUtils, AppPathConstants, RouteConstants, RuntimeBridge, SystemConstants } from '@fromcode119/core/client';
import { AdminPathUtils } from './admin-path';

export class AdminConstants {
  static readonly API_VERSION_PREFIX = ApiVersionUtils.prefix();

  static readonly SECONDARY_SIDEBAR = {
    WIDTH_PX: 280,
    MOBILE_BREAKPOINT: 1024,
    PANEL_ID: 'admin-secondary-sidebar-panel',
  } as const;

  static readonly API_BASE_URL = RuntimeBridge.resolveApiBaseUrl();

  static readonly SYSTEM_PLUGIN_SLUG = 'system';

  static readonly ROUTES = AppPathConstants.ADMIN;

  static readonly ADMIN_URLS = {
  PATH: (path: string) => AdminPathUtils.toAdminPath(path),
  AUTH: {
    LOGIN: () => AdminPathUtils.toAdminPath(AdminConstants.ROUTES.AUTH.LOGIN),
    LOGIN_SESSION_EXPIRED: () =>
      AdminPathUtils.toAdminPath(AdminConstants.withQuery(AdminConstants.ROUTES.AUTH.LOGIN, { reason: 'session_expired' })),
  },
} as const;

  static readonly ENDPOINTS = {
  AUTH: {
    LOGIN: AdminConstants.v(SystemConstants.API_PATH.AUTH.LOGIN),
    LOGOUT: AdminConstants.v(SystemConstants.API_PATH.AUTH.LOGOUT),
    STATUS: AdminConstants.v(SystemConstants.API_PATH.AUTH.STATUS),
    SETUP: AdminConstants.v(SystemConstants.API_PATH.AUTH.SETUP),
    REGISTER: AdminConstants.v(SystemConstants.API_PATH.AUTH.REGISTER),
    VERIFY_EMAIL: AdminConstants.v(SystemConstants.API_PATH.AUTH.VERIFY_EMAIL),
    RESEND_VERIFICATION: AdminConstants.v(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION),
    FORGOT_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.FORGOT_PASSWORD),
    RESET_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.RESET_PASSWORD),
    VERIFY_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.VERIFY_PASSWORD),
    CHANGE_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.CHANGE_PASSWORD),
    SECURITY: AdminConstants.v(SystemConstants.API_PATH.AUTH.SECURITY),
    EMAIL_CHANGE_REQUEST: AdminConstants.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_REQUEST),
    EMAIL_CHANGE_CONFIRM: AdminConstants.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_CONFIRM),
    SESSIONS: AdminConstants.v(SystemConstants.API_PATH.AUTH.SESSIONS),
    MY_SESSIONS: AdminConstants.v(SystemConstants.API_PATH.AUTH.MY_SESSIONS),
    REVOKE_MY_SESSION: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.REVOKE_SESSION, { id })),
    REVOKE_OTHER_SESSIONS: AdminConstants.v(SystemConstants.API_PATH.AUTH.REVOKE_OTHER_SESSIONS),
    API_TOKENS: AdminConstants.v(SystemConstants.API_PATH.AUTH.API_TOKENS),
    API_TOKEN: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.API_TOKEN, { id })),
    SSO_PROVIDERS: AdminConstants.v(SystemConstants.API_PATH.AUTH.SSO_PROVIDERS),
    SSO_LOGIN: AdminConstants.v(SystemConstants.API_PATH.AUTH.SSO_LOGIN),
  },
  PLUGINS: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.BASE),
    LIST: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.BASE),
    ACTIVE: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.ACTIVE),
    MARKETPLACE: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.MARKETPLACE),
    UPLOAD: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD),
    UPLOAD_INSPECT: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT),
    STAGED: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PLUGINS),
    INSTALL: (slug: string) => AdminConstants.v(`${SystemConstants.API_PATH.PLUGINS.INSTALL}/${encodeURIComponent(slug)}`),
    TOGGLE: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.TOGGLE, { slug })),
    CONFIG: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.CONFIG, { slug })),
    LOGS: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, { slug }),
    DELETE: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.DELETE, { slug })),
    SETTINGS: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, { slug }),
    SETTINGS_SCHEMA: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_SCHEMA, { slug }),
    SETTINGS_RESET: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_RESET, { slug }),
    SETTINGS_EXPORT: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_EXPORT, { slug }),
    SETTINGS_IMPORT: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_IMPORT, { slug }),
  },
  THEMES: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.THEMES.BASE),
    LIST: AdminConstants.v(SystemConstants.API_PATH.THEMES.BASE),
    MARKETPLACE: AdminConstants.v(SystemConstants.API_PATH.THEMES.MARKETPLACE),
    UPLOAD: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD),
    UPLOAD_INSPECT: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_INSPECT),
    ACTIVATE: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, { slug }),
    RESET: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_RESET, { slug }),
    INSTALL: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_INSTALL, { slug }),
    CONFIG: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, { slug }),
    DELETE: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG, { slug }),
  },
  SYSTEM: {
    HEALTH: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.HEALTH),
    SETTINGS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_SETTINGS),
    STATS: {
      COLLECTIONS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_STATS),
      SECURITY: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_SECURITY),
    },
    EMAIL_TELEMETRY_TEST: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_TELEMETRY_EMAIL_TEST),
    FRONTEND: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.FRONTEND),
    LOGS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_LOGS),
    AUDIT: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_AUDIT),
    ROLES: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_ROLES),
    PERMISSIONS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_PERMISSIONS),
    USERS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_USERS),
    USER: (id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_USER, { id })),
    USER_2FA: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_DISABLE, { id }),
    USER_2FA_STATUS: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_STATUS, { id }),
    USER_2FA_SETUP: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_SETUP, { id }),
    USER_2FA_VERIFY: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_VERIFY, { id }),
    USER_2FA_RECOVERY_REGENERATE: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_RECOVERY, { id }),
    USER_ROLES: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_ROLES),
    METADATA: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PLUGINS),
    INTEGRATIONS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS),
    INTEGRATION: (type: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_TYPE, { type }),
    INTEGRATION_PROFILE_ACTIVATE: (type: string, profileId: string) =>
      AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE_ACTIVATE, { type, profileId }),
    INTEGRATION_PROFILE: (type: string, profileId: string) =>
      AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE, { type, profileId }),
    INTEGRATION_PROVIDER: (type: string, providerId: string) =>
      AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROVIDER, { type, providerId }),
    UPDATE_CHECK: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.UPDATE_CHECK),
    UPDATE_APPLY: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.UPDATE_APPLY),
    OPENAPI: AdminConstants.legacy(SystemConstants.API_PATH.SYSTEM.OPENAPI),
    I18N: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.I18N),
    EVENTS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.EVENTS),
  },
  COLLECTIONS: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.COLLECTIONS.BASE),
    SETTINGS_BASE: AdminConstants.v(SystemConstants.API_PATH.COLLECTIONS.SETTINGS),
    SETTINGS: (key: string) => AdminConstants.v(ApiPathUtils.fillPath(`${SystemConstants.API_PATH.COLLECTIONS.SETTINGS}/:key`, { key })),
  },
  MEDIA: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.MEDIA.BASE),
    UPLOAD: AdminConstants.v(SystemConstants.API_PATH.MEDIA.UPLOAD),
  },
  VERSIONS: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.VERSIONS.BASE),
    GET: (slug: string, id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.VERSIONS.ITEM, { slug, id })),
    RESTORE: (slug: string, id: string, version: number) =>
      AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.VERSIONS.RESTORE, { slug, id, version })),
  }
};

  static readonly FRAMEWORK_RESOURCES = {
  DOCUMENTATION: 'https://docs.fromcode.com',
  DEVELOPER_GUIDE: 'https://docs.fromcode.com/developer-guide',
  FRAMEWORK_ROADMAP: 'https://github.com/fromcode119',
  SUPPORT: 'https://docs.fromcode.com/support',
  GITHUB: 'https://github.com/fromcode119',
  DISCORD: 'https://discord.gg/fromcode',
  TWITTER: 'https://x.com/fromcode119',
  OPENAPI: AdminConstants.ENDPOINTS.SYSTEM.OPENAPI,
} as const;

  private static v(path: string): string {
    return `${AdminConstants.API_VERSION_PREFIX}${path}`;
  }

  private static legacy(path: string): string {
    return `${AdminConstants.rootApiPrefix()}${path}`;
  }

  private static rootApiPrefix(): string {
    return AdminConstants.API_VERSION_PREFIX.replace(/\/v\d+$/, '');
  }

  private static versionedRoute(
    basePath: string,
    segment: string,
    params?: Record<string, string | number>,
  ): string {
    return AdminConstants.v(ApiPathUtils.fillPath(`${basePath}${segment}`, params));
  }

  private static withQuery(path: string, query: Record<string, string | number | boolean | undefined | null>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }
}
