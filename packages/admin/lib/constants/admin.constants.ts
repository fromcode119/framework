// Deep imports, not core's `client` barrel — this module is reachable from the MIDDLEWARE graph and
// the barrel re-exports enums that import reactor's `Reactor` class component. See admin-proxy.ts.
import { ApiPathUtils } from '@fromcode119/core/api/api-path-utils';
import { ApiVersionUtils } from '@fromcode119/core/api-version';
import { AppPathConstants } from '@fromcode119/core/constants/app-path.constants';
import { RouteConstants } from '@fromcode119/core/constants/route.constants';
import { RuntimeBridge } from '@fromcode119/core/runtime-bridge';
import { SystemConstants } from '@fromcode119/core/constants/system.constants';
import { AdminPathUtils } from '@/lib/admin-path';

export class AdminConstants {
  static readonly API_VERSION_PREFIX = ApiVersionUtils.prefix();

  static readonly SECONDARY_SIDEBAR = {
    WIDTH_PX: 280,
    MOBILE_BREAKPOINT: 1024,
    PANEL_ID: 'admin-secondary-sidebar-panel',
  } as const;

  static readonly API_BASE_URL = RuntimeBridge.resolveApiBaseUrl();

  static readonly SYSTEM_PLUGIN_SLUG = 'system';

  static readonly ROUTES = AppPathConstants.ADMIN;

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
    LOGIN: AdminConstants.v(SystemConstants.API_PATH.AUTH.LOGIN),
    LOGOUT: AdminConstants.v(SystemConstants.API_PATH.AUTH.LOGOUT),
    STATUS: AdminConstants.v(SystemConstants.API_PATH.AUTH.STATUS),
    HOST_INFO: AdminConstants.v(SystemConstants.API_PATH.AUTH.HOST_INFO),
    TENANTS_AVAILABLE: AdminConstants.v(SystemConstants.API_PATH.AUTH.TENANTS_AVAILABLE),
    TENANTS_SELECT: AdminConstants.v(SystemConstants.API_PATH.AUTH.TENANTS_SELECT),
    SETUP: AdminConstants.v(SystemConstants.API_PATH.AUTH.SETUP),
    REGISTER: AdminConstants.v(SystemConstants.API_PATH.AUTH.REGISTER),
    VERIFY_EMAIL: AdminConstants.v(SystemConstants.API_PATH.AUTH.VERIFY_EMAIL),
    RESEND_VERIFICATION: AdminConstants.v(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION),
    FORGOT_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.FORGOT_PASSWORD),
    RESET_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.RESET_PASSWORD),
    ADMIN_SEND_PASSWORD_RESET: AdminConstants.v(SystemConstants.API_PATH.AUTH.ADMIN_SEND_PASSWORD_RESET),
    VERIFY_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.VERIFY_PASSWORD),
    CHANGE_PASSWORD: AdminConstants.v(SystemConstants.API_PATH.AUTH.CHANGE_PASSWORD),
    SECURITY: AdminConstants.v(SystemConstants.API_PATH.AUTH.SECURITY),
    EMAIL_CHANGE_REQUEST: AdminConstants.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_REQUEST),
    EMAIL_CHANGE_CONFIRM: AdminConstants.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_CONFIRM),
    SESSIONS: AdminConstants.v(SystemConstants.API_PATH.AUTH.SESSIONS),
    MY_SESSIONS: AdminConstants.v(SystemConstants.API_PATH.AUTH.MY_SESSIONS),
    REVOKE_MY_SESSION: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.REVOKE_SESSION, { id })),
    REVOKE_OTHER_SESSIONS: AdminConstants.v(SystemConstants.API_PATH.AUTH.REVOKE_OTHER_SESSIONS),
    API_TOKENS: AdminConstants.v(SystemConstants.API_PATH.AUTH.API_TOKENS),
    API_TOKEN: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.API_TOKEN, { id })),
    SSO_PROVIDERS: AdminConstants.v(SystemConstants.API_PATH.AUTH.SSO_PROVIDERS),
    SSO_LOGIN: AdminConstants.v(SystemConstants.API_PATH.AUTH.SSO_LOGIN),
  },
  PLUGINS: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.BASE),
    LIST: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.BASE),
    ACTIVE: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.ACTIVE),
    MARKETPLACE: AdminConstants.v(SystemConstants.API_PATH.PLUGINS.MARKETPLACE),
    INSTALL_OPERATION: (operationId: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_INSTALL_OPERATION, { operationId }),
    UPLOAD_SESSION: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION),
    UPLOAD_CHUNK: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_CHUNK),
    UPLOAD_SESSION_INSPECT: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION_INSPECT),
    UPLOAD: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD),
    UPLOAD_INSPECT: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT),
    UPLOAD_COMPLETE: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_COMPLETE),
    STAGED: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PLUGINS),
    INSTALL: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.INSTALL, { slug })),
    TOGGLE: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.TOGGLE, { slug })),
    REAPPROVE_ALL: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_REAPPROVE_ALL),
    UPDATE_ALL: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPDATE_ALL),
    HEALTH: AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_HEALTH),
    CONFIG: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.CONFIG, { slug })),
    LOGS: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, { slug }),
    DELETE: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.DELETE, { slug })),
    SETTINGS: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, { slug }),
    SETTINGS_SCHEMA: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_SCHEMA, { slug }),
    SETTINGS_RESET: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_RESET, { slug }),
    SETTINGS_EXPORT: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_EXPORT, { slug }),
    SETTINGS_IMPORT: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_IMPORT, { slug }),
  },
  THEMES: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.THEMES.BASE),
    LIST: AdminConstants.v(SystemConstants.API_PATH.THEMES.BASE),
    MARKETPLACE: AdminConstants.v(SystemConstants.API_PATH.THEMES.MARKETPLACE),
    UPLOAD_SESSION: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION),
    UPLOAD_CHUNK: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_CHUNK),
    UPLOAD_SESSION_INSPECT: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION_INSPECT),
    UPLOAD: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD),
    UPLOAD_INSPECT: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_INSPECT),
    UPLOAD_COMPLETE: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_COMPLETE),
    ACTIVE_ASSETS: AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_ACTIVE_ASSETS),
    ACTIVATE: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, { slug }),
    DISABLE: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_DISABLE, { slug }),
    RESET: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_RESET, { slug }),
    INSTALL: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_INSTALL, { slug }),
    CONFIG: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, { slug }),
    DELETE: (slug: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG, { slug }),
  },
  SYSTEM: {
    HEALTH: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.HEALTH),
    SETTINGS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_SETTINGS),
    SETTINGS_PLATFORM_KEYS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_SETTINGS_PLATFORM_KEYS),
    BACKUPS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUPS),
    BACKUP: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP, { id })),
    BACKUP_CREATE_SYSTEM: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_CREATE_SYSTEM),
    BACKUP_IMPORT: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT),
    BACKUP_IMPORT_SESSION: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT_SESSION),
    BACKUP_IMPORT_CHUNK: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT_CHUNK),
    BACKUP_IMPORT_COMPLETE: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT_COMPLETE),
    BACKUP_DOWNLOAD: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_DOWNLOAD, { id })),
    BACKUP_RESTORE_PREVIEW: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_RESTORE_PREVIEW, { id })),
    BACKUP_RESTORE_EXECUTE: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_RESTORE_EXECUTE, { id })),
    /** Tenant provisioning (Sites) — platform admins only. */
    TENANTS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS),
    CERTIFICATES: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATES),
    CERTIFICATE_PLATFORM_ADDRESSES: `${AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATES)}/platform-addresses`,
    CERTIFICATE: (host: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATE, { host })),
    CERTIFICATE_SOURCE: (host: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATE_SOURCE, { host })),
    TENANT: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT, { id })),
    TENANT_EXPORT: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_EXPORT, { id })),
    TENANT_PAGES: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_PAGES, { id })),
    TENANT_MEMBERS_LIST: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_MEMBERS_LIST, { id })),
    TENANT_MEMBERS: (id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_MEMBERS, { id })),
    TENANT_MEMBER: (id: string, userId: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_MEMBER, { id, userId })),
    TENANTS_IMPORT_SESSION: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_SESSION),
    TENANTS_IMPORT_CHUNK: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_CHUNK),
    TENANTS_IMPORT_PREVIEW: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_PREVIEW),
    TENANTS_IMPORT_EXECUTE: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_EXECUTE),
    TENANTS_ADOPT: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_ADOPT),
    STATS: {
      COLLECTIONS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_STATS),
      SECURITY: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_SECURITY),
      HOST: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_HOST),
      SCHEDULE: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_SCHEDULE),
      ATTENTION: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_ATTENTION),
      SITES: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_SITES),
      RECENT_EDITS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_RECENT_EDITS),
      INSTALLATION: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_INSTALLATION),
    },
    EMAIL_TELEMETRY_TEST: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_TELEMETRY_EMAIL_TEST),
    FRONTEND: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.FRONTEND),
    LOGS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_LOGS),
    AUDIT: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_AUDIT),
    ROLES: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_ROLES),
    PERMISSIONS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_PERMISSIONS),
    USERS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_USERS),
    USER: (id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_USER, { id })),
    USER_2FA: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_DISABLE, { id }),
    USER_2FA_STATUS: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_STATUS, { id }),
    USER_2FA_SETUP: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_SETUP, { id }),
    USER_2FA_VERIFY: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_VERIFY, { id }),
    USER_2FA_RECOVERY_REGENERATE: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_RECOVERY, { id }),
    USER_ROLES: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_ROLES),
    USER_OWNERSHIP: (id: string | number) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_OWNERSHIP, { id }),
    PEOPLE: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE),
    PERSON: (id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_ID, { id })),
    PERSON_SAVE: (id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_ID, { id })),
    PERSON_CREATE_USER: (id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_CREATE_USER, { id })),
    PEOPLE_SUGGEST: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_SUGGEST),
    PERSON_RECORDS: (id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_ID_RECORDS, { id })),
    METADATA: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PLUGINS),
    INTEGRATIONS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS),
    INTEGRATION: (type: string) => AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_TYPE, { type }),
    INTEGRATION_PROFILE_ACTIVATE: (type: string, profileId: string) =>
      AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE_ACTIVATE, { type, profileId }),
    INTEGRATION_PROFILE: (type: string, profileId: string) =>
      AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE, { type, profileId }),
    INTEGRATION_PROVIDER: (type: string, providerId: string) =>
      AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROVIDER, { type, providerId }),
    DEPLOY_APPS: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.DEPLOY_APPS),
    DEPLOY_RESTART: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.DEPLOY_RESTART),
    UPDATE_CHECK: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.UPDATE_CHECK),
    UPDATE_APPLY: AdminConstants.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.UPDATE_APPLY),
    OPENAPI: AdminConstants.legacy(SystemConstants.API_PATH.SYSTEM.OPENAPI),
    I18N: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.I18N),
    EVENTS: AdminConstants.v(SystemConstants.API_PATH.SYSTEM.EVENTS),
  },
  COLLECTIONS: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.COLLECTIONS.BASE),
    SETTINGS_BASE: AdminConstants.v(SystemConstants.API_PATH.COLLECTIONS.SETTINGS),
    SETTINGS: (key: string) => AdminConstants.v(ApiPathUtils.fillPath(`${SystemConstants.API_PATH.COLLECTIONS.SETTINGS}/:key`, { key })),
    // Per-collection record + action paths (no hardcoded suffixes at call sites).
    ITEM: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.ITEM, { slug })),
    DETAIL: (slug: string, id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.DETAIL, { slug, id })),
    EXPORT: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.EXPORT, { slug })),
    IMPORT: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.IMPORT, { slug })),
    BULK_UPDATE: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.BULK_UPDATE, { slug })),
    BULK_DELETE: (slug: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.BULK_DELETE, { slug })),
  },
  MEDIA: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.MEDIA.BASE),
    UPLOAD: AdminConstants.v(SystemConstants.API_PATH.MEDIA.UPLOAD),
    ID_RAW: (id: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.MEDIA.ID_RAW, { id })),
  },
  FILES: {
    SHARES: AdminConstants.v(SystemConstants.API_PATH.FILES.SHARES),
    SHARE: (shareId: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.SHARE, { shareId })),
    SHARE_GRANTS: (shareId: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.SHARE_GRANTS, { shareId })),
    GRANT: (grantId: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.GRANT, { grantId })),
    MEDIA_GRANTS: (mediaId: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.MEDIA_GRANTS, { mediaId })),
    SHARE_ACTIVITY: (shareId: string | number) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.SHARE_ACTIVITY, { shareId })),
    ACTIVITY: (query: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
      return `${AdminConstants.v(SystemConstants.API_PATH.FILES.ACTIVITY)}?${params.toString()}`;
    },
  },
  VERSIONS: {
    BASE: AdminConstants.v(SystemConstants.API_PATH.VERSIONS.BASE),
    GET: (slug: string, id: string) => AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.VERSIONS.ITEM, { slug, id })),
    RESTORE: (slug: string, id: string, version: number) =>
      AdminConstants.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.VERSIONS.RESTORE, { slug, id, version })),
  }
};

  /**
   * Only destinations that actually resolve may be listed here. `docs.fromcode.com` does not exist
   * (DNS/connection failure on `/`, `/support` and `/developer-guide`) and `x.com/fromcode119` returns
   * 404, so DOCUMENTATION, DEVELOPER_GUIDE, SUPPORT and TWITTER were removed along with every link
   * that rendered them — shipping a nav item to nowhere is the same class of lie as a fabricated stat.
   * Re-add an entry only once its URL has been verified to respond.
   */
  static readonly FRAMEWORK_RESOURCES = {
  GITHUB: 'https://github.com/fromcode119',
  /** The product's own documentation site, beside the repository it documents. */
  DOCS: 'https://docs.fromcode.com',
  OPENAPI: AdminConstants.ENDPOINTS.SYSTEM.OPENAPI,
} as const;

  private static v(path: string): string {
    return `${AdminConstants.API_VERSION_PREFIX}${path}`;
  }

  private static legacy(path: string): string {
    return `${AdminConstants.rootApiPrefix()}${path}`;
  }

  private static rootApiPrefix(): string {
    return AdminConstants.API_VERSION_PREFIX.replace(/\/v\d+$/, '');
  }

  private static versionedRoute(
    basePath: string,
    segment: string,
    params?: Record<string, string | number>,
  ): string {
    return AdminConstants.v(ApiPathUtils.fillPath(`${basePath}${segment}`, params));
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
