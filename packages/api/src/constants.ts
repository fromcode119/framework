export const API_ROUTES = {
  AUTH: {
    STATUS: '/api/auth/status',
    SETUP: '/api/auth/setup',
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    SESSIONS: '/api/auth/sessions',
    KILL_SESSION: (id: string) => `/api/auth/sessions/${id}/kill`,
  },
  PLUGINS: {
    BASE: '/api/plugins',
    ACTIVE: '/api/plugins/active',
    TOGGLE: (slug: string) => `/api/plugins/${slug}/toggle`,
    CONFIG: (slug: string) => `/api/plugins/${slug}/config`,
    SAVE_CONFIG: (slug: string) => `/api/plugins/${slug}/config`,
    DELETE: (slug: string) => `/api/plugins/${slug}`,
    MARKETPLACE: '/api/marketplace/plugins',
    INSTALL: (slug: string) => `/api/marketplace/install/${slug}`,
    UI: '/plugins/:slug/ui/*',
  },
  SYSTEM: {
    ADMIN_PLUGINS: '/api/system/admin/metadata',
    ADMIN_STATS: '/api/system/admin/stats/collections',
    HEALTH: '/api/health',
    OPENAPI: '/api/openapi.json',
    I18N: '/api/system/i18n',
  },
  COLLECTIONS: {
    BASE: '/api/collections',
    ITEM: '/api/collections/:slug',
    DETAIL: '/api/collections/:slug/:id',
  }
};
