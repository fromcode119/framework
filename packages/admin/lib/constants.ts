
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api.framework.local';

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    STATUS: '/api/auth/status',
    SETUP: '/api/auth/setup',
    SESSIONS: '/api/auth/sessions',
  },
  PLUGINS: {
    BASE: '/api/plugins',
    LIST: '/api/plugins',
    ACTIVE: '/api/plugins/active',
    REGISTRY: '/api/plugins/registry',
    UPLOAD: '/api/plugins/upload',
    STAGED: '/api/system/admin/plugins',
    INSTALL: (slug: string) => `/api/plugins/install/${slug}`,
    TOGGLE: (slug: string) => `/api/plugins/${slug}/toggle`,
    CONFIG: (slug: string) => `/api/plugins/${slug}/config`,
    LOGS: (slug: string) => `/api/plugins/${slug}/logs`,
    DELETE: (slug: string) => `/api/plugins/${slug}`,
  },
  SYSTEM: {
    HEALTH: '/api/health',
    STATS: {
      COLLECTIONS: '/api/system/admin/stats/collections',
    },
    LOGS: '/api/system/admin/logs',
    OPENAPI: '/api/openapi.json',
    I18N: '/api/system/i18n',
  },
  COLLECTIONS: {
    BASE: '/api/collections',
  },
  MEDIA: {
    BASE: '/api/media',
    UPLOAD: '/api/media/upload',
  }
};
