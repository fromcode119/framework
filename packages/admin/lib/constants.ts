
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
    REGISTRY: v('/plugins/registry'),
    UPLOAD: v('/plugins/upload'),
    STAGED: v('/system/admin/plugins'),
    INSTALL: (slug: string) => v(`/plugins/install/${slug}`),
    TOGGLE: (slug: string) => v(`/plugins/${slug}/toggle`),
    CONFIG: (slug: string) => v(`/plugins/${slug}/config`),
    LOGS: (slug: string) => v(`/plugins/${slug}/logs`),
    DELETE: (slug: string) => v(`/plugins/${slug}`),
  },
  THEMES: {
    BASE: v('/themes'),
    LIST: v('/themes'),
    REGISTRY: v('/themes/registry'),
    MARKETPLACE: v('/themes/registry'),
    ACTIVATE: (slug: string) => v(`/themes/${slug}/activate`),
    INSTALL: (slug: string) => v(`/themes/${slug}/install`),
    DELETE: (slug: string) => v(`/themes/${slug}`),
  },
  SYSTEM: {
    HEALTH: '/api/health',
    STATS: {
      COLLECTIONS: v('/system/admin/stats/collections'),
    },
    LOGS: v('/system/admin/logs'),
    ROLES: v('/system/admin/roles'),
    PERMISSIONS: v('/system/admin/permissions'),
    USERS: v('/system/admin/users'),
    USER: (id: string | number) => v(`/system/admin/users/${id}`),
    USER_ROLES: v('/system/admin/users/roles'),
    UPDATE_CHECK: v('/system/update/check'),
    UPDATE_APPLY: v('/system/update/apply'),
    OPENAPI: '/api/openapi.json',
    I18N: v('/system/i18n'),
  },
  COLLECTIONS: {
    BASE: v('/collections'),
  },
  MEDIA: {
    BASE: v('/media'),
    UPLOAD: v('/media/upload'),
  }
};
