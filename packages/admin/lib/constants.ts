
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.framework.local';

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
  SYSTEM: {
    HEALTH: '/api/health',
    STATS: {
      COLLECTIONS: v('/system/admin/stats/collections'),
    },
    LOGS: v('/system/admin/logs'),
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
