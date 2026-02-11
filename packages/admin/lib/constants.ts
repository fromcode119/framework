
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.fromcode.local';

// Helper to construct versioned URLs
const v = (path: string) => `/api/${API_VERSION}${path}`;

export const ENDPOINTS = {
  AUTH: {
    LOGIN: v('/auth/login'),
    LOGOUT: v('/auth/logout'),
    STATUS: v('/auth/status'),
    SETUP: v('/auth/setup'),
    SESSIONS: v('/auth/sessions'),
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
    FRONTEND: v('/system/frontend'),
    LOGS: v('/system/admin/logs'),
    AUDIT: v('/system/admin/audit'),
    ROLES: v('/system/admin/roles'),
    PERMISSIONS: v('/system/admin/permissions'),
    USERS: v('/system/admin/users'),
    USER: (id: string | number) => v(`/system/admin/users/${id}`),
    USER_ROLES: v('/system/admin/users/roles'),
    METADATA: v('/system/admin/metadata'),
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
