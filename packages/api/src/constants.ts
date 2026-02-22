import { API_RESOURCE_PATHS, buildApiVersionPrefix, normalizeApiVersion } from '@fromcode/core';

export const API_VERSION = normalizeApiVersion();
export const API_PREFIXES = {
  BASE: '/api',
  VERSIONED: buildApiVersionPrefix()
} as const;

const normalizeRoutePath = (path: unknown, fallback: string) => {
  const value = String(path || '').trim();
  if (!value) return fallback;
  return value.startsWith('/') ? value : `/${value}`;
};

const withVersion = (path: unknown) => `${API_PREFIXES.VERSIONED}${normalizeRoutePath(path, '/')}`;
const withoutVersion = (path: unknown) => `${API_PREFIXES.BASE}${normalizeRoutePath(path, '/')}`;

const SYSTEM_HEALTH_PATH = normalizeRoutePath((API_RESOURCE_PATHS as any)?.SYSTEM?.HEALTH, '/health');

export const API_ROUTES = {
  AUTH: {
    STATUS: withVersion('/auth/status'),
    SETUP: withVersion('/auth/setup'),
    REGISTER: withVersion(API_RESOURCE_PATHS.AUTH.REGISTER),
    VERIFY_EMAIL: withVersion(API_RESOURCE_PATHS.AUTH.VERIFY_EMAIL),
    RESEND_VERIFICATION: withVersion(API_RESOURCE_PATHS.AUTH.RESEND_VERIFICATION),
    FORGOT_PASSWORD: withVersion(API_RESOURCE_PATHS.AUTH.FORGOT_PASSWORD),
    RESET_PASSWORD: withVersion(API_RESOURCE_PATHS.AUTH.RESET_PASSWORD),
    VERIFY_PASSWORD: withVersion('/auth/verify-password'),
    CHANGE_PASSWORD: withVersion('/auth/change-password'),
    SECURITY: withVersion('/auth/security'),
    EMAIL_CHANGE_REQUEST: withVersion('/auth/email-change/request'),
    EMAIL_CHANGE_CONFIRM: withVersion(API_RESOURCE_PATHS.AUTH.EMAIL_CHANGE_CONFIRM),
    SSO_PROVIDERS: withVersion('/auth/sso/providers'),
    SSO_LOGIN: withVersion('/auth/sso/login'),
    LOGIN: withVersion('/auth/login'),
    LOGOUT: withVersion('/auth/logout'),
    SESSIONS: withVersion('/auth/sessions'),
    MY_SESSIONS: withVersion('/auth/sessions/me'),
    REVOKE_MY_SESSION: (id: string) => withVersion(`/auth/sessions/${id}/revoke`),
    REVOKE_OTHER_SESSIONS: withVersion('/auth/sessions/revoke-others'),
    KILL_SESSION: (id: string) => withVersion(`/auth/sessions/${id}/kill`),
    API_TOKENS: withVersion('/auth/api-tokens'),
    API_TOKEN: (id: string) => withVersion(`/auth/api-tokens/${id}`),
  },
  PLUGINS: {
    BASE: withVersion('/plugins'),
    ACTIVE: withVersion('/plugins/active'),
    TOGGLE: (slug: string) => withVersion(`/plugins/${slug}/toggle`),
    CONFIG: (slug: string) => withVersion(`/plugins/${slug}/config`),
    SAVE_CONFIG: (slug: string) => withVersion(`/plugins/${slug}/config`),
    DELETE: (slug: string) => withVersion(`/plugins/${slug}`),
    MARKETPLACE: withVersion('/marketplace/plugins'),
    INSTALL: (slug: string) => withVersion(`/marketplace/install/${slug}`),
    UI: '/plugins/:slug/ui/*',
  },
  SYSTEM: {
    ADMIN_PLUGINS: withVersion('/system/admin/metadata'),
    ADMIN_STATS: withVersion('/system/admin/stats/collections'),
    HEALTH: withVersion(SYSTEM_HEALTH_PATH),
    OPENAPI: withVersion('/openapi.json'),
    I18N: withVersion(API_RESOURCE_PATHS.SYSTEM.I18N),
    EVENTS: withVersion(API_RESOURCE_PATHS.SYSTEM.EVENTS),
  },
  COLLECTIONS: {
    BASE: withVersion(API_RESOURCE_PATHS.COLLECTIONS.BASE),
    ITEM: withVersion('/collections/:slug'),
    DETAIL: withVersion('/collections/:slug/:id'),
  }
};

export const LEGACY_API_ROUTES = {
  SYSTEM: {
    HEALTH: withoutVersion(SYSTEM_HEALTH_PATH),
    OPENAPI: withoutVersion('/openapi.json')
  },
  COLLECTIONS: {
    BASE: withoutVersion('/collections')
  }
} as const;

export const APP_ROUTES = {
  AUTH: {
    LOGIN: '/login',
    SETUP: '/setup',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    VERIFY_EMAIL: '/verify-email',
    VERIFY_EMAIL_CHANGE: '/verify-email-change'
  }
} as const;

export const STORAGE_CONFIG = {
  UPLOAD_DIR_ENV: 'STORAGE_UPLOAD_DIR',
  PUBLIC_URL_ENV: 'STORAGE_PUBLIC_URL',
  DEFAULT_UPLOADS_SUBDIR: 'public/uploads',
  DEFAULT_PUBLIC_URL: '/uploads'
} as const;

export const PUBLIC_ROUTE_PREFIXES = {
  PLUGIN_ASSETS: '/plugins/'
} as const;

export function resolveStoragePublicUrl(rawValue: string | undefined = process.env.STORAGE_PUBLIC_URL): string {
  const value = String(rawValue || '').trim();
  if (!value) return STORAGE_CONFIG.DEFAULT_PUBLIC_URL;
  return value.startsWith('/') ? value : `/${value}`;
}

export const RESERVED_PERMALINK_CONFIG = {
  ROOT_SEGMENTS: ['api', '_next', 'plugins', 'themes', 'media', 'uploads'] as const,
  EXACT_PATHS: [
    APP_ROUTES.AUTH.LOGIN,
    APP_ROUTES.AUTH.SETUP,
    APP_ROUTES.AUTH.REGISTER,
    APP_ROUTES.AUTH.FORGOT_PASSWORD,
    APP_ROUTES.AUTH.RESET_PASSWORD,
    APP_ROUTES.AUTH.VERIFY_EMAIL,
    APP_ROUTES.AUTH.VERIFY_EMAIL_CHANGE,
    '/about'
  ] as const
} as const;
