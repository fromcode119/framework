import { buildApiVersionPrefix } from '@fromcode/sdk';

const API_VERSION_PREFIX = buildApiVersionPrefix();
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const v = (path: string) => `${API_VERSION_PREFIX}${path}`;
const withQuery = (path: string, query: Record<string, string | number | boolean | undefined | null>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

export const ROUTES = {
  ROOT: '/',
  ACTIVITY: '/activity',
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
  SETTINGS: {
    ROOT: '/settings',
    GENERAL: '/settings/general',
    INTEGRATIONS: '/settings/integrations',
    INTEGRATIONS_BY_TYPE: (type: string) => withQuery('/settings/integrations', { type }),
    LOCALIZATION: '/settings/localization',
    ROUTING: '/settings/routing',
    SECURITY: '/settings/security',
    INFRASTRUCTURE: '/settings/infrastructure',
    UPDATES: '/settings/updates'
  }
} as const;

export const ENDPOINTS = {
  AUTH: {
    LOGIN: v('/auth/login'),
    LOGOUT: v('/auth/logout'),
    STATUS: v('/auth/status'),
    SETUP: v('/auth/setup'),
    REGISTER: v('/auth/register'),
    VERIFY_EMAIL: v('/auth/verify-email'),
    RESEND_VERIFICATION: v('/auth/resend-verification'),
    FORGOT_PASSWORD: v('/auth/forgot-password'),
    RESET_PASSWORD: v('/auth/reset-password'),
    VERIFY_PASSWORD: v('/auth/verify-password'),
    CHANGE_PASSWORD: v('/auth/change-password'),
    SECURITY: v('/auth/security'),
    EMAIL_CHANGE_REQUEST: v('/auth/email-change/request'),
    EMAIL_CHANGE_CONFIRM: v('/auth/email-change/confirm'),
    SESSIONS: v('/auth/sessions'),
    MY_SESSIONS: v('/auth/sessions/me'),
    REVOKE_MY_SESSION: (id: string) => v(`/auth/sessions/${id}/revoke`),
    REVOKE_OTHER_SESSIONS: v('/auth/sessions/revoke-others'),
    API_TOKENS: v('/auth/api-tokens'),
    API_TOKEN: (id: string) => v(`/auth/api-tokens/${id}`),
    SSO_PROVIDERS: v('/auth/sso/providers'),
    SSO_LOGIN: v('/auth/sso/login'),
  },
  PLUGINS: {
    BASE: v('/plugins'),
    LIST: v('/plugins'),
    ACTIVE: v('/plugins/active'),
    MARKETPLACE: v('/marketplace/plugins'),
    UPLOAD: v('/plugins/upload'),
    STAGED: v('/system/admin/metadata'),
    INSTALL: (slug: string) => v(`/marketplace/install/${slug}`),
    TOGGLE: (slug: string) => v(`/plugins/${slug}/toggle`),
    CONFIG: (slug: string) => v(`/plugins/${slug}/config`),
    LOGS: (slug: string) => v(`/plugins/${slug}/logs`),
    DELETE: (slug: string) => v(`/plugins/${slug}`),
    SETTINGS: (slug: string) => v(`/plugins/${slug}/settings`),
    SETTINGS_SCHEMA: (slug: string) => v(`/plugins/${slug}/settings/schema`),
    SETTINGS_RESET: (slug: string) => v(`/plugins/${slug}/settings/reset`),
    SETTINGS_EXPORT: (slug: string) => v(`/plugins/${slug}/settings/export`),
    SETTINGS_IMPORT: (slug: string) => v(`/plugins/${slug}/settings/import`),
  },
  THEMES: {
    BASE: v('/themes'),
    LIST: v('/themes'),
    MARKETPLACE: v('/themes/marketplace'),
    ACTIVATE: (slug: string) => v(`/themes/${slug}/activate`),
    RESET: (slug: string) => v(`/themes/${slug}/reset`),
    INSTALL: (slug: string) => v(`/themes/${slug}/install`),
    CONFIG: (slug: string) => v(`/themes/${slug}/config`),
    DELETE: (slug: string) => v(`/themes/${slug}`),
  },
  SYSTEM: {
    HEALTH: '/api/health',
    STATS: {
      COLLECTIONS: v('/system/admin/stats/collections'),
      SECURITY: v('/system/admin/stats/security'),
    },
    EMAIL_TELEMETRY_TEST: v('/system/admin/telemetry/email-test'),
    FRONTEND: v('/system/frontend'),
    LOGS: v('/system/admin/logs'),
    AUDIT: v('/system/admin/audit'),
    ROLES: v('/system/admin/roles'),
    PERMISSIONS: v('/system/admin/permissions'),
    USERS: v('/system/admin/users'),
    USER: (id: string | number) => v(`/system/admin/users/${id}`),
    USER_2FA: (id: string | number) => v(`/system/admin/users/${id}/2fa`),
    USER_2FA_STATUS: (id: string | number) => v(`/system/admin/users/${id}/2fa/status`),
    USER_2FA_SETUP: (id: string | number) => v(`/system/admin/users/${id}/2fa/setup`),
    USER_2FA_VERIFY: (id: string | number) => v(`/system/admin/users/${id}/2fa/verify`),
    USER_2FA_RECOVERY_REGENERATE: (id: string | number) => v(`/system/admin/users/${id}/2fa/recovery-codes/regenerate`),
    USER_ROLES: v('/system/admin/users/roles'),
    METADATA: v('/system/admin/metadata'),
    INTEGRATIONS: v('/system/admin/integrations'),
    INTEGRATION: (type: string) => v(`/system/admin/integrations/${type}`),
    INTEGRATION_PROFILE_ACTIVATE: (type: string, profileId: string) =>
      v(`/system/admin/integrations/${type}/profiles/${encodeURIComponent(profileId)}/activate`),
    INTEGRATION_PROFILE: (type: string, profileId: string) =>
      v(`/system/admin/integrations/${type}/profiles/${encodeURIComponent(profileId)}`),
    INTEGRATION_PROVIDER: (type: string, providerId: string) =>
      v(`/system/admin/integrations/${type}/providers/${encodeURIComponent(providerId)}`),
    UPDATE_CHECK: v('/system/update/check'),
    UPDATE_APPLY: v('/system/update/apply'),
    OPENAPI: '/api/openapi.json',
    I18N: v('/system/i18n'),
    EVENTS: v('/system/events'),
  },
  COLLECTIONS: {
    BASE: v('/collections'),
  },
  MEDIA: {
    BASE: v('/media'),
    UPLOAD: v('/media/upload'),
  },
  VERSIONS: {
    BASE: v('/versions'),
    GET: (slug: string, id: string) => v(`/versions/${slug}/${id}`),
    RESTORE: (slug: string, id: string, version: number) => v(`/versions/${slug}/${id}/${version}/restore`),
  }
};
