import { buildApiVersionPrefix, normalizeApiVersion } from '@fromcode119/sdk';
import { ApiPath, AppPath, StorageConfig, PublicRoutePrefixes } from '@fromcode119/sdk/internal';
import { resolveStoragePublicUrlBase as resolveBase, resolveStoragePublicPath as resolvePath } from './utils/url';

/**
 * Reserved permalink segments that cannot be used as user content slugs.
 */
export const RESERVED_PERMALINK_CONFIG = {
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
    'health',
    'graphql',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml'
  ] as const,
  EXACT_PATHS: [
    '/',
    '/health',
    '/openapi.json'
  ] as const
} as const;



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

export const API_ROUTES = {
  AUTH: {
    STATUS: withVersion(ApiPath.AUTH.STATUS),
    SETUP: withVersion(ApiPath.AUTH.SETUP),
    REGISTER: withVersion(ApiPath.AUTH.REGISTER),
    VERIFY_EMAIL: withVersion(ApiPath.AUTH.VERIFY_EMAIL),
    RESEND_VERIFICATION: withVersion(ApiPath.AUTH.RESEND_VERIFICATION),
    FORGOT_PASSWORD: withVersion(ApiPath.AUTH.FORGOT_PASSWORD),
    RESET_PASSWORD: withVersion(ApiPath.AUTH.RESET_PASSWORD),
    VERIFY_PASSWORD: withVersion(ApiPath.AUTH.VERIFY_PASSWORD),
    CHANGE_PASSWORD: withVersion(ApiPath.AUTH.CHANGE_PASSWORD),
    SECURITY: withVersion(ApiPath.AUTH.SECURITY),
    EMAIL_CHANGE_REQUEST: withVersion(ApiPath.AUTH.EMAIL_CHANGE_REQUEST),
    EMAIL_CHANGE_CONFIRM: withVersion(ApiPath.AUTH.EMAIL_CHANGE_CONFIRM),
    SSO_PROVIDERS: withVersion(ApiPath.AUTH.SSO_PROVIDERS),
    SSO_LOGIN: withVersion(ApiPath.AUTH.SSO_LOGIN),
    LOGIN: withVersion(ApiPath.AUTH.LOGIN),
    LOGOUT: withVersion(ApiPath.AUTH.LOGOUT),
    SESSIONS: withVersion(ApiPath.AUTH.SESSIONS),
    MY_SESSIONS: withVersion(ApiPath.AUTH.MY_SESSIONS),
    REVOKE_MY_SESSION: (id: string) => withVersion(ApiPath.AUTH.REVOKE_SESSION.replace(':id', id)),
    REVOKE_OTHER_SESSIONS: withVersion(ApiPath.AUTH.REVOKE_OTHER_SESSIONS),
    KILL_SESSION: (id: string) => withVersion(ApiPath.AUTH.KILL_SESSION.replace(':id', id)),
    API_TOKENS: withVersion(ApiPath.AUTH.API_TOKENS),
    API_TOKEN: (id: string) => withVersion(ApiPath.AUTH.API_TOKEN.replace(':id', id)),
  },
  PLUGINS: {
    BASE: withVersion(ApiPath.PLUGINS.BASE),
    ACTIVE: withVersion(ApiPath.PLUGINS.ACTIVE),
    TOGGLE: (slug: string) => withVersion(ApiPath.PLUGINS.TOGGLE.replace(':slug', slug)),
    CONFIG: (slug: string) => withVersion(ApiPath.PLUGINS.CONFIG.replace(':slug', slug)),
    SAVE_CONFIG: (slug: string) => withVersion(ApiPath.PLUGINS.CONFIG.replace(':slug', slug)),
    DELETE: (slug: string) => withVersion(ApiPath.PLUGINS.DELETE.replace(':slug', slug)),
    MARKETPLACE: withVersion(ApiPath.PLUGINS.MARKETPLACE),
    INSTALL: (slug: string) => withVersion(`${ApiPath.PLUGINS.INSTALL}/${slug}`),
    UI: ApiPath.PLUGINS.UI,
  },
  SYSTEM: {
    ADMIN_PLUGINS: withVersion(ApiPath.SYSTEM.ADMIN_PLUGINS),
    ADMIN_STATS: withVersion(ApiPath.SYSTEM.ADMIN_STATS),
    HEALTH: withVersion(ApiPath.SYSTEM.HEALTH),
    OPENAPI: withVersion(ApiPath.SYSTEM.OPENAPI),
    I18N: withVersion(ApiPath.SYSTEM.I18N),
    EVENTS: withVersion(ApiPath.SYSTEM.EVENTS),
  },
  COLLECTIONS: {
    BASE: withVersion(ApiPath.COLLECTIONS.BASE),
    ITEM: withVersion(ApiPath.COLLECTIONS.ITEM),
    DETAIL: withVersion(ApiPath.COLLECTIONS.DETAIL),
  }
};

export const LEGACY_API_ROUTES = {
  SYSTEM: {
    HEALTH: withoutVersion(ApiPath.SYSTEM.HEALTH),
    OPENAPI: withoutVersion(ApiPath.SYSTEM.OPENAPI)
  },
  COLLECTIONS: {
    BASE: withoutVersion(ApiPath.COLLECTIONS.BASE)
  }
} as const;

export const APP_ROUTES = {
  AUTH: {
    LOGIN: AppPath.AUTH.LOGIN,
    SETUP: AppPath.AUTH.SETUP,
    REGISTER: AppPath.AUTH.REGISTER,
    FORGOT_PASSWORD: AppPath.AUTH.FORGOT_PASSWORD,
    RESET_PASSWORD: AppPath.AUTH.RESET_PASSWORD,
    VERIFY_EMAIL: AppPath.AUTH.VERIFY_EMAIL,
    VERIFY_EMAIL_CHANGE: AppPath.AUTH.VERIFY_EMAIL_CHANGE
  }
} as const;

export const STORAGE_CONFIG = StorageConfig;
export const PUBLIC_ROUTE_PREFIXES = PublicRoutePrefixes;

export function resolveStoragePublicUrlBase(rawValue: string | undefined = process.env.STORAGE_PUBLIC_URL): string {
  return resolveBase(rawValue, STORAGE_CONFIG.DEFAULT_PUBLIC_URL);
}

export function resolveStoragePublicPath(rawValue: string | undefined = process.env.STORAGE_PUBLIC_URL): string {
  return resolvePath(rawValue, STORAGE_CONFIG.DEFAULT_PUBLIC_URL);
}

// Backward-compatible alias used by existing API code paths.
export function resolveStoragePublicUrl(rawValue: string | undefined = process.env.STORAGE_PUBLIC_URL): string {
  return resolveStoragePublicPath(rawValue);
}

