import { RouteConstants } from './route-constants';

export class AppPathConstants {
  /** File names an appearance's built `dist/` exposes under its `/ui/` asset route. */
  static readonly APPEARANCE_ASSETS = {
    UI_SEGMENT: 'ui',
    BUNDLE: 'bundle.js',
    STYLESHEET: 'appearance.css',
  } as const;

  static readonly AUTH = {
    LOGIN: '/login',
    SETUP: '/setup',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    VERIFY_EMAIL: '/verify-email',
    VERIFY_EMAIL_CHANGE: '/verify-email-change',
    PUBLIC: [
      '/login',
      '/setup',
      '/forgot-password',
      '/reset-password',
    ] as const,
  } as const;

  /** Frontend (storefront) app routes referenced from other apps (e.g. admin linking to self-service). */
  static readonly FRONTEND = {
    ACCOUNT: '/account',
  } as const;

  static readonly ADMIN = {
    ROOT: '/',
    MINIMAL: '/atlantis',
    ACTIVITY: '/activity',
    ACTIVITY_FILTER: (query: Record<string, string | number | boolean | undefined | null>) =>
      AppPathConstants.withQuery('/activity', query),
    MEDIA: {
      ROOT: '/media',
    },
    ADMIN: {
      BASE: RouteConstants.SEGMENTS.ADMIN_BASE,
    },
    AUTH: AppPathConstants.AUTH,
    USERS: {
      ROOT: '/users',
      LIST: '/users',
      NEW: '/users/new',
      DETAIL: (id: string | number) => `/users/${id}`,
      EDIT: (id: string | number) => `/users/${id}/edit`,
      ROLES: (id: string | number) => `/users/${id}/roles`,
      SECURITY: (id: string | number) => `/users/${id}/security`,
      AUTH_ACTIVITY: (id: string | number) => AppPathConstants.withFragment(`/users/${id}/security`, 'auth-activity'),
      ROLE_LIST: '/users/roles',
      ROLE_NEW: '/users/roles/new',
      ROLE_EDIT: (slug: string) => `/users/roles/${slug}/edit`,
      PERMISSIONS: '/users/permissions',
      PERMISSIONS_NEW: '/users/permissions/new',
    },
    PEOPLE: {
      ROOT: '/users/people',
      LIST: '/users/people',
      DETAIL: (id: string | number) => `/users/people/${id}`,
    },
    PLUGINS: {
      ROOT: '/plugins',
      INSTALLED: '/plugins/installed',
      HEALTH: '/plugins/health',
      MARKETPLACE: '/plugins/marketplace',
      MARKETPLACE_DETAIL: (slug: string) => `/plugins/marketplace/${slug}`,
      DETAIL: (slug: string) => `/plugins/${slug}`,
      SETTINGS: (slug: string) => `/plugins/${slug}/settings`,
      SETTINGS_TAB: (slug: string) => AppPathConstants.withQuery(`/plugins/${slug}`, { tab: 'settings' }),
    },
    SETTINGS: {
      ROOT: '/settings',
      GENERAL: '/settings/general',
      INTEGRATIONS: '/settings/integrations',
      INTEGRATIONS_BY_TYPE: (type: string) => AppPathConstants.withQuery('/settings/integrations', { type }),
      LOCALIZATION: '/settings/localization',
      APPEARANCE: '/settings/appearance',
      ROUTING: '/settings/routing',
      SECURITY: '/settings/security',
      INFRASTRUCTURE: '/settings/infrastructure',
      BACKUPS: '/settings/backups',
      UPDATES: '/settings/updates',
      FRAMEWORK: '/settings/framework',
    },
    /**
     * External appearance runtime assets, served by the admin appearance asset route
     * (`/appearances/<id>/ui/<file>`). The id is URL-encoded — callers pass a raw appearance id.
     */
    APPEARANCES: {
      ROOT: RouteConstants.SEGMENTS.APPEARANCES,
      UI_BUNDLE: (id: string) => AppPathConstants.appearanceAsset(id, AppPathConstants.APPEARANCE_ASSETS.BUNDLE),
      UI_STYLESHEET: (id: string) => AppPathConstants.appearanceAsset(id, AppPathConstants.APPEARANCE_ASSETS.STYLESHEET),
    },
    THEMES: {
      ROOT: '/themes',
      INSTALLED: '/themes/installed',
      MARKETPLACE: '/themes/marketplace',
      DETAIL: (slug: string) => `/themes/${slug}`,
      MARKETPLACE_DETAIL: (slug: string) => `/themes/marketplace/${slug}`,
      SETTINGS_TAB: (slug: string) => AppPathConstants.withQuery(`/themes/${slug}`, { tab: 'settings' }),
    },
  } as const;

  private static appearanceAsset(id: string, file: string): string {
    const segments = [
      RouteConstants.SEGMENTS.APPEARANCES,
      encodeURIComponent(String(id || '')),
      AppPathConstants.APPEARANCE_ASSETS.UI_SEGMENT,
      file,
    ];
    return segments.join('/').replace(/\/{2,}/g, '/');
  }

  private static withFragment(path: string, fragment: string): string {
    return `${path}#${fragment}`;
  }

  private static withQuery(
    path: string,
    query: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }
}
