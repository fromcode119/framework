import { ApiVersionUtils } from '@fromcode119/sdk';
import { AdminPathUtils } from './admin-path';

export class AdminConstants {
  static readonly API_VERSION_PREFIX = ApiVersionUtils.prefix();

  static readonly API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  static readonly ROUTES = {
  ROOT: '/',
  MINIMAL: '/forge',
  ACTIVITY: '/activity',
  ADMIN: {
    BASE: '/admin',
  },
  AUTH: {
    LOGIN: '/login',
    SETUP: '/setup',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    PUBLIC: ['/login', '/setup', '/forgot-password', '/reset-password']
  },
  USERS: {
    ROOT: '/users',
    LIST: '/users',
    NEW: '/users/new',
    DETAIL: (id: string | number) => `/users/${id}`,
    EDIT: (id: string | number) => `/users/${id}/edit`,
    ROLES: (id: string | number) => `/users/${id}/roles`,
    SECURITY: (id: string | number) => `/users/${id}/security`,
    AUTH_ACTIVITY: (id: string | number) => `/users/${id}/security#auth-activity`,
    ROLE_LIST: '/users/roles',
    PERMISSIONS: '/users/permissions'
  },
  PLUGINS: {
    ROOT: '/plugins',
    INSTALLED: '/plugins/installed',
    MARKETPLACE: '/plugins/marketplace',
    DETAIL: (slug: string) => `/plugins/${slug}`,
    SETTINGS: (slug: string) => `/plugins/${slug}/settings`,
    PUBLISHER: '/plugins/publisher',
  },
  SETTINGS: {
    ROOT: '/settings',
    GENERAL: '/settings/general',
    INTEGRATIONS: '/settings/integrations',
    INTEGRATIONS_BY_TYPE: (type: string) => AdminConstants.withQuery('/settings/integrations', { type }),
    LOCALIZATION: '/settings/localization',
    ROUTING: '/settings/routing',
    SECURITY: '/settings/security',
    INFRASTRUCTURE: '/settings/infrastructure',
    UPDATES: '/settings/updates',
    FRAMEWORK: '/settings/framework',
  },
  THEMES: {
    ROOT: '/themes',
    INSTALLED: '/themes/installed',
    MARKETPLACE: '/themes/marketplace',
    DETAIL: (slug: string) => `/themes/${slug}`,
    MARKETPLACE_DETAIL: (slug: string) => `/themes/marketplace/${slug}`,
    SETTINGS_TAB: (slug: string) => AdminConstants.withQuery(`/themes/${slug}`, { tab: 'settings' })
  }
} as const;

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
    LOGIN: AdminConstants.v('/auth/login'),
    LOGOUT: AdminConstants.v('/auth/logout'),
    STATUS: AdminConstants.v('/auth/status'),
    SETUP: AdminConstants.v('/auth/setup'),
    REGISTER: AdminConstants.v('/auth/register'),
    VERIFY_EMAIL: AdminConstants.v('/auth/verify-email'),
    RESEND_VERIFICATION: AdminConstants.v('/auth/resend-verification'),
    FORGOT_PASSWORD: AdminConstants.v('/auth/forgot-password'),
    RESET_PASSWORD: AdminConstants.v('/auth/reset-password'),
    VERIFY_PASSWORD: AdminConstants.v('/auth/verify-password'),
    CHANGE_PASSWORD: AdminConstants.v('/auth/change-password'),
    SECURITY: AdminConstants.v('/auth/security'),
    EMAIL_CHANGE_REQUEST: AdminConstants.v('/auth/email-change/request'),
    EMAIL_CHANGE_CONFIRM: AdminConstants.v('/auth/email-change/confirm'),
    SESSIONS: AdminConstants.v('/auth/sessions'),
    MY_SESSIONS: AdminConstants.v('/auth/sessions/me'),
    REVOKE_MY_SESSION: (id: string) => AdminConstants.v(`/auth/sessions/${id}/revoke`),
    REVOKE_OTHER_SESSIONS: AdminConstants.v('/auth/sessions/revoke-others'),
    API_TOKENS: AdminConstants.v('/auth/api-tokens'),
    API_TOKEN: (id: string) => AdminConstants.v(`/auth/api-tokens/${id}`),
    SSO_PROVIDERS: AdminConstants.v('/auth/sso/providers'),
    SSO_LOGIN: AdminConstants.v('/auth/sso/login'),
  },
  PLUGINS: {
    BASE: AdminConstants.v('/plugins'),
    LIST: AdminConstants.v('/plugins'),
    ACTIVE: AdminConstants.v('/plugins/active'),
    MARKETPLACE: AdminConstants.v('/marketplace/plugins'),
    UPLOAD: AdminConstants.v('/plugins/upload'),
    UPLOAD_INSPECT: AdminConstants.v('/plugins/upload/inspect'),
    STAGED: AdminConstants.v('/system/admin/metadata'),
    INSTALL: (slug: string) => AdminConstants.v(`/marketplace/install/${slug}`),
    TOGGLE: (slug: string) => AdminConstants.v(`/plugins/${slug}/toggle`),
    CONFIG: (slug: string) => AdminConstants.v(`/plugins/${slug}/config`),
    LOGS: (slug: string) => AdminConstants.v(`/plugins/${slug}/logs`),
    DELETE: (slug: string) => AdminConstants.v(`/plugins/${slug}`),
    SETTINGS: (slug: string) => AdminConstants.v(`/plugins/${slug}/settings`),
    SETTINGS_SCHEMA: (slug: string) => AdminConstants.v(`/plugins/${slug}/settings/schema`),
    SETTINGS_RESET: (slug: string) => AdminConstants.v(`/plugins/${slug}/settings/reset`),
    SETTINGS_EXPORT: (slug: string) => AdminConstants.v(`/plugins/${slug}/settings/export`),
    SETTINGS_IMPORT: (slug: string) => AdminConstants.v(`/plugins/${slug}/settings/import`),
  },
  THEMES: {
    BASE: AdminConstants.v('/themes'),
    LIST: AdminConstants.v('/themes'),
    MARKETPLACE: AdminConstants.v('/themes/marketplace'),
    UPLOAD: AdminConstants.v('/themes/upload'),
    UPLOAD_INSPECT: AdminConstants.v('/themes/upload/inspect'),
    ACTIVATE: (slug: string) => AdminConstants.v(`/themes/${slug}/activate`),
    RESET: (slug: string) => AdminConstants.v(`/themes/${slug}/reset`),
    INSTALL: (slug: string) => AdminConstants.v(`/themes/${slug}/install`),
    CONFIG: (slug: string) => AdminConstants.v(`/themes/${slug}/config`),
    DELETE: (slug: string) => AdminConstants.v(`/themes/${slug}`),
  },
  SYSTEM: {
    HEALTH: '/api/health',
    STATS: {
      COLLECTIONS: AdminConstants.v('/system/admin/stats/collections'),
      SECURITY: AdminConstants.v('/system/admin/stats/security'),
    },
    EMAIL_TELEMETRY_TEST: AdminConstants.v('/system/admin/telemetry/email-test'),
    FRONTEND: AdminConstants.v('/system/frontend'),
    LOGS: AdminConstants.v('/system/admin/logs'),
    AUDIT: AdminConstants.v('/system/admin/audit'),
    ROLES: AdminConstants.v('/system/admin/roles'),
    PERMISSIONS: AdminConstants.v('/system/admin/permissions'),
    USERS: AdminConstants.v('/system/admin/users'),
    USER: (id: string | number) => AdminConstants.v(`/system/admin/users/${id}`),
    USER_2FA: (id: string | number) => AdminConstants.v(`/system/admin/users/${id}/2fa`),
    USER_2FA_STATUS: (id: string | number) => AdminConstants.v(`/system/admin/users/${id}/2fa/status`),
    USER_2FA_SETUP: (id: string | number) => AdminConstants.v(`/system/admin/users/${id}/2fa/setup`),
    USER_2FA_VERIFY: (id: string | number) => AdminConstants.v(`/system/admin/users/${id}/2fa/verify`),
    USER_2FA_RECOVERY_REGENERATE: (id: string | number) => AdminConstants.v(`/system/admin/users/${id}/2fa/recovery-codes/regenerate`),
    USER_ROLES: AdminConstants.v('/system/admin/users/roles'),
    METADATA: AdminConstants.v('/system/admin/metadata'),
    INTEGRATIONS: AdminConstants.v('/system/admin/integrations'),
    INTEGRATION: (type: string) => AdminConstants.v(`/system/admin/integrations/${type}`),
    INTEGRATION_PROFILE_ACTIVATE: (type: string, profileId: string) =>
      AdminConstants.v(`/system/admin/integrations/${type}/profiles/${encodeURIComponent(profileId)}/activate`),
    INTEGRATION_PROFILE: (type: string, profileId: string) =>
      AdminConstants.v(`/system/admin/integrations/${type}/profiles/${encodeURIComponent(profileId)}`),
    INTEGRATION_PROVIDER: (type: string, providerId: string) =>
      AdminConstants.v(`/system/admin/integrations/${type}/providers/${encodeURIComponent(providerId)}`),
    UPDATE_CHECK: AdminConstants.v('/system/update/check'),
    UPDATE_APPLY: AdminConstants.v('/system/update/apply'),
    OPENAPI: '/api/openapi.json',
    I18N: AdminConstants.v('/system/i18n'),
    EVENTS: AdminConstants.v('/system/events'),
  },
  COLLECTIONS: {
    BASE: AdminConstants.v('/collections'),
  },
  MEDIA: {
    BASE: AdminConstants.v('/media'),
    UPLOAD: AdminConstants.v('/media/upload'),
  },
  VERSIONS: {
    BASE: AdminConstants.v('/versions'),
    GET: (slug: string, id: string) => AdminConstants.v(`/versions/${slug}/${id}`),
    RESTORE: (slug: string, id: string, version: number) => AdminConstants.v(`/versions/${slug}/${id}/${version}/restore`),
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
