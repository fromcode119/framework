// Deep imports, not core's `client` barrel — this module is reachable from the MIDDLEWARE graph and
// the barrel re-exports enums that import reactor's `Reactor` class component. See admin-proxy.ts.
import { ApiPathUtils } from '@fromcode119/core/api/api-path-utils';
import { ApiVersionUtils } from '@fromcode119/core/api-version';
import { AppPathConstants } from '@fromcode119/core/constants/app-path.constants';
import { RouteConstants } from '@fromcode119/core/constants/route.constants';
import { RuntimeBridge } from '@fromcode119/core/runtime-bridge';
import { SystemConstants } from '@fromcode119/core/constants/system.constants';
import { AdminPathUtils } from '@/lib/admin-path';
import { AdminApiPaths } from '@/lib/constants/admin-api-paths';

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
      AdminPathUtils.toAdminPath(AdminApiPaths.withQuery(AdminConstants.ROUTES.AUTH.LOGIN, { reason: 'session_expired' })),
  },
} as const;

  static readonly ENDPOINTS = {
  /** The first-run wizard's own calls. Answered even by a deployment with no database yet. */
  SETUP: {
    STATUS: AdminApiPaths.v(SystemConstants.API_PATH.SETUP.STATUS),
    DATABASE: AdminApiPaths.v(SystemConstants.API_PATH.SETUP.DATABASE),
  },
  /** Sources. The per-source suffixes are appended to an encoded `<base>/<kind>/<slug>`. */
  SOURCES: {
    BASE: AdminApiPaths.v(SystemConstants.API_PATH.SOURCES.BASE),
    PROVIDERS: AdminApiPaths.v(SystemConstants.API_PATH.SOURCES.PROVIDERS),
    BUILD_ALL: AdminApiPaths.v(SystemConstants.API_PATH.SOURCES.BUILD_ALL),
    CHECK_UPDATES: AdminApiPaths.v(SystemConstants.API_PATH.SOURCES.CHECK_UPDATES),
    BRANCHES: AdminApiPaths.v(SystemConstants.API_PATH.SOURCES.BRANCHES),
    INSPECT: AdminApiPaths.v(SystemConstants.API_PATH.SOURCES.INSPECT),
    BUILD_SUFFIX: SystemConstants.API_PATH.SOURCES.BUILD_SUFFIX,
    PACKAGE_SUFFIX: SystemConstants.API_PATH.SOURCES.PACKAGE_SUFFIX,
    VERSIONS_SUFFIX: SystemConstants.API_PATH.SOURCES.VERSIONS_SUFFIX,
    INSTALL_SUFFIX: SystemConstants.API_PATH.SOURCES.INSTALL_SUFFIX,
  },
  AUTH: {
    LOGIN: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.LOGIN),
    LOGOUT: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.LOGOUT),
    STATUS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.STATUS),
    HOST_INFO: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.HOST_INFO),
    TENANTS_AVAILABLE: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TENANTS_AVAILABLE),
    TENANTS_SELECT: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TENANTS_SELECT),
    TENANTS_LEAVE: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.TENANTS_LEAVE),
    SETUP: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SETUP),
    REGISTER: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.REGISTER),
    VERIFY_EMAIL: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.VERIFY_EMAIL),
    RESEND_VERIFICATION: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.RESEND_VERIFICATION),
    FORGOT_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.FORGOT_PASSWORD),
    RESET_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.RESET_PASSWORD),
    ADMIN_SEND_PASSWORD_RESET: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.ADMIN_SEND_PASSWORD_RESET),
    VERIFY_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.VERIFY_PASSWORD),
    CHANGE_PASSWORD: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.CHANGE_PASSWORD),
    SECURITY: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SECURITY),
    EMAIL_CHANGE_REQUEST: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_REQUEST),
    EMAIL_CHANGE_CONFIRM: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.EMAIL_CHANGE_CONFIRM),
    SESSIONS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SESSIONS),
    MY_SESSIONS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.MY_SESSIONS),
    REVOKE_MY_SESSION: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.REVOKE_SESSION, { id })),
    REVOKE_OTHER_SESSIONS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.REVOKE_OTHER_SESSIONS),
    API_TOKENS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.API_TOKENS),
    API_TOKEN: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.AUTH.API_TOKEN, { id })),
    SSO_PROVIDERS: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SSO_PROVIDERS),
    SSO_LOGIN: AdminApiPaths.v(SystemConstants.API_PATH.AUTH.SSO_LOGIN),
  },
  PLUGINS: {
    BASE: AdminApiPaths.v(SystemConstants.API_PATH.PLUGINS.BASE),
    LIST: AdminApiPaths.v(SystemConstants.API_PATH.PLUGINS.BASE),
    ACTIVE: AdminApiPaths.v(SystemConstants.API_PATH.PLUGINS.ACTIVE),
    MARKETPLACE: AdminApiPaths.v(SystemConstants.API_PATH.PLUGINS.MARKETPLACE),
    /** What the platform offers to sites; the platform's switch; a site switching one on or off for itself. */
    OFFERED: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_OFFERED),
    OFFER: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_OFFER, { slug }),
    SITE: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SITE, { slug }),
    INSTALL_OPERATION: (operationId: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_INSTALL_OPERATION, { operationId }),
    UPLOAD_SESSION: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION),
    UPLOAD_CHUNK: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_CHUNK),
    UPLOAD_SESSION_INSPECT: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_SESSION_INSPECT),
    UPLOAD: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD),
    UPLOAD_INSPECT: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_INSPECT),
    UPLOAD_COMPLETE: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPLOAD_COMPLETE),
    STAGED: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PLUGINS),
    INSTALL: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.INSTALL, { slug })),
    TOGGLE: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.TOGGLE, { slug })),
    REAPPROVE_ALL: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_REAPPROVE_ALL),
    UPDATE_ALL: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_UPDATE_ALL),
    HEALTH: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_HEALTH),
    CONFIG: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.CONFIG, { slug })),
    LOGS: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_LOGS, { slug }),
    RUNTIME: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_RUNTIME, { slug }),
    LOAD_INSTALLED: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_LOAD_INSTALLED, { slug }),
    DELETE: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.PLUGINS.DELETE, { slug })),
    SETTINGS: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS, { slug }),
    SETTINGS_SCHEMA: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_SCHEMA, { slug }),
    SETTINGS_RESET: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_RESET, { slug }),
    SETTINGS_EXPORT: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_EXPORT, { slug }),
    SETTINGS_IMPORT: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.PLUGINS.BASE, RouteConstants.SEGMENTS.PLUGINS_SLUG_SETTINGS_IMPORT, { slug }),
  },
  THEMES: {
    LIST: AdminApiPaths.v(SystemConstants.API_PATH.THEMES.BASE),
    MARKETPLACE: AdminApiPaths.v(SystemConstants.API_PATH.THEMES.MARKETPLACE),
    UPLOAD_SESSION: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION),
    UPLOAD_CHUNK: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_CHUNK),
    UPLOAD_SESSION_INSPECT: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_SESSION_INSPECT),
    UPLOAD: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD),
    UPLOAD_INSPECT: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_INSPECT),
    UPLOAD_COMPLETE: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_UPLOAD_COMPLETE),
    ACTIVE_ASSETS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_ACTIVE_ASSETS),
    ACTIVATE: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_ACTIVATE, { slug }),
    DISABLE: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_DISABLE, { slug }),
    RESET: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_RESET, { slug }),
    INSTALL: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_INSTALL, { slug }),
    CONFIG: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_CONFIG, { slug }),
    DELETE: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG, { slug }),
    /** A SITE's own themes: uploaded into, and removed from, that site's own directory. */
    MINE_UPLOAD: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_MINE_UPLOAD),
    MINE_QUOTA: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_MINE_QUOTA),
    MINE_DELETE: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_MINE_SLUG, { slug }),
    /** A SITE adding a marketplace theme to itself (installed once and shared, never updated from a site). */
    ADD_TO_SITE: (slug: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.THEMES.BASE, RouteConstants.SEGMENTS.THEMES_SLUG_ADD_TO_SITE, { slug }),
  },
  SYSTEM: {
    HEALTH: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.HEALTH),
    SETTINGS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_SETTINGS),
    SETTINGS_PLATFORM_KEYS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_SETTINGS_PLATFORM_KEYS),
    PERSONAL_DATA_POLICY: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_PERSONAL_DATA_POLICY),
    BACKUPS: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUPS),
    BACKUP: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP, { id })),
    BACKUP_CREATE_SYSTEM: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_CREATE_SYSTEM),
    BACKUP_IMPORT: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT),
    BACKUP_IMPORT_SESSION: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT_SESSION),
    BACKUP_IMPORT_CHUNK: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT_CHUNK),
    BACKUP_IMPORT_COMPLETE: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_IMPORT_COMPLETE),
    BACKUP_DOWNLOAD: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_DOWNLOAD, { id })),
    BACKUP_RESTORE_PREVIEW: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_RESTORE_PREVIEW, { id })),
    BACKUP_RESTORE_EXECUTE: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_BACKUP_RESTORE_EXECUTE, { id })),
    /** Tenant provisioning (Sites) — platform admins only. */
    TENANTS: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS),
    /** A one-time link that opens one site while it is still private. See SitePreviewRouter. */
    SITE_PREVIEW_SESSION: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.SITE_PREVIEW_SESSION, { id })),
    CERTIFICATES: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATES),
    CERTIFICATE_PLATFORM_ADDRESSES: `${AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATES)}/platform-addresses`,
    CERTIFICATE: (host: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATE, { host })),
    CERTIFICATE_SOURCE: (host: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATE_SOURCE, { host })),
    CERTIFICATE_CLOUDFLARE_TOKEN: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_CERTIFICATE_CLOUDFLARE_TOKEN),
    TENANT: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT, { id })),
    TENANT_EXPORT: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_EXPORT, { id })),
    TENANT_PAGES: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_PAGES, { id })),
    TENANT_MEMBERS_LIST: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_MEMBERS_LIST, { id })),
    TENANT_MEMBERS: (id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_MEMBERS, { id })),
    TENANT_MEMBER: (id: string, userId: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANT_MEMBER, { id, userId })),
    TENANTS_IMPORT_SESSION: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_SESSION),
    TENANTS_IMPORT_CHUNK: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_CHUNK),
    TENANTS_IMPORT_PREVIEW: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_PREVIEW),
    TENANTS_IMPORT_EXECUTE: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_EXECUTE),
    TENANTS_IMPORT_STANDALONE: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_IMPORT_STANDALONE),
    TENANTS_ADOPT: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_TENANTS_ADOPT),
    STATS: {
      COLLECTIONS: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_STATS),
      SECURITY: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_SECURITY),
      HOST: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_HOST),
      SCHEDULE: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_SCHEDULE),
      ATTENTION: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_ATTENTION),
      SITES: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_SITES),
      RECENT_EDITS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_RECENT_EDITS),
      INSTALLATION: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_STATS_INSTALLATION),
    },
    EMAIL_TELEMETRY_TEST: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_TELEMETRY_EMAIL_TEST),
    FRONTEND: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.FRONTEND),
    LOGS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_LOGS),
    AUDIT: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_AUDIT),
    ROLES: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_ROLES),
    PERMISSIONS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_PERMISSIONS),
    USERS: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_USERS),
    USER: (id: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_USER, { id })),
    USER_2FA: (id: string | number) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_DISABLE, { id }),
    USER_2FA_STATUS: (id: string | number) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_STATUS, { id }),
    USER_2FA_SETUP: (id: string | number) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_SETUP, { id }),
    USER_2FA_VERIFY: (id: string | number) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_VERIFY, { id }),
    USER_2FA_RECOVERY_REGENERATE: (id: string | number) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_2FA_RECOVERY, { id }),
    USER_ROLES: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_ROLES),
    USER_OWNERSHIP: (id: string | number) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_USERS_OWNERSHIP, { id }),
    PEOPLE: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE),
    PERSON: (id: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_ID, { id })),
    PERSON_SAVE: (id: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_ID, { id })),
    PERSON_CREATE_USER: (id: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_CREATE_USER, { id })),
    PEOPLE_SUGGEST: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_SUGGEST),
    PERSON_RECORDS: (id: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.ADMIN_PEOPLE_ID_RECORDS, { id })),
    /** Records RELATED to one record. `keys` is a JSON object of correlation keys the subject offers. */
    RECORD_LINKS: (kind: string, id: string | number, keys: Record<string, string>) => AdminApiPaths.v(
      `${SystemConstants.API_PATH.SYSTEM.ADMIN_RECORD_LINKS}?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(String(id))}&keys=${encodeURIComponent(JSON.stringify(keys))}`,
    ),
    /** Which plugin's design a storefront page shows while its content is empty. */
    PAGE_DESIGN: (collection: string, id: string | number) => AdminApiPaths.v(`${SystemConstants.API_PATH.SYSTEM.ADMIN_PAGE_DESIGN}?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(String(id))}`),
    METADATA: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.ADMIN_PLUGINS),
    INTEGRATIONS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS),
    INTEGRATION: (type: string) => AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_TYPE, { type }),
    INTEGRATION_PROFILE_ACTIVATE: (type: string, profileId: string) =>
      AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE_ACTIVATE, { type, profileId }),
    INTEGRATION_PROFILE: (type: string, profileId: string) =>
      AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE, { type, profileId }),
    INTEGRATION_PROVIDER: (type: string, providerId: string) =>
      AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROVIDER, { type, providerId }),
    DEPLOY_APPS: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.DEPLOY_APPS),
    DEPLOY_RESTART: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.DEPLOY_RESTART),
    DEPLOY_CAPACITY: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.DEPLOY_CAPACITY),
    UPDATE_CHECK: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.UPDATE_CHECK),
    UPDATE_APPLY: AdminApiPaths.versionedRoute(SystemConstants.API_PATH.SYSTEM.BASE, RouteConstants.SEGMENTS.UPDATE_APPLY),
    OPENAPI: AdminApiPaths.legacy(SystemConstants.API_PATH.SYSTEM.OPENAPI),
    I18N: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.I18N),
    EVENTS: AdminApiPaths.v(SystemConstants.API_PATH.SYSTEM.EVENTS),
  },
  COLLECTIONS: {
    BASE: AdminApiPaths.v(SystemConstants.API_PATH.COLLECTIONS.BASE),
    SETTINGS_BASE: AdminApiPaths.v(SystemConstants.API_PATH.COLLECTIONS.SETTINGS),
    SETTINGS: (key: string) => AdminApiPaths.v(ApiPathUtils.fillPath(`${SystemConstants.API_PATH.COLLECTIONS.SETTINGS}/:key`, { key })),
    // Per-collection record + action paths (no hardcoded suffixes at call sites).
    ITEM: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.ITEM, { slug })),
    DETAIL: (slug: string, id: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.DETAIL, { slug, id })),
    EXPORT: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.EXPORT, { slug })),
    IMPORT: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.IMPORT, { slug })),
    BULK_UPDATE: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.BULK_UPDATE, { slug })),
    BULK_DELETE: (slug: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.COLLECTIONS.BULK_DELETE, { slug })),
  },
  MEDIA: {
    BASE: AdminApiPaths.v(SystemConstants.API_PATH.MEDIA.BASE),
    UPLOAD: AdminApiPaths.v(SystemConstants.API_PATH.MEDIA.UPLOAD),
    ID_RAW: (id: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.MEDIA.ID_RAW, { id })),
  },
  FILES: {
    SHARES: AdminApiPaths.v(SystemConstants.API_PATH.FILES.SHARES),
    SHARE: (shareId: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.SHARE, { shareId })),
    SHARE_GRANTS: (shareId: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.SHARE_GRANTS, { shareId })),
    GRANT: (grantId: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.GRANT, { grantId })),
    MEDIA_GRANTS: (mediaId: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.MEDIA_GRANTS, { mediaId })),
    SHARE_ACTIVITY: (shareId: string | number) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.FILES.SHARE_ACTIVITY, { shareId })),
    ACTIVITY: (query: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
      return `${AdminApiPaths.v(SystemConstants.API_PATH.FILES.ACTIVITY)}?${params.toString()}`;
    },
  },
  VERSIONS: {
    BASE: AdminApiPaths.v(SystemConstants.API_PATH.VERSIONS.BASE),
    GET: (slug: string, id: string) => AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.VERSIONS.ITEM, { slug, id })),
    RESTORE: (slug: string, id: string, version: number) =>
      AdminApiPaths.v(ApiPathUtils.fillPath(SystemConstants.API_PATH.VERSIONS.RESTORE, { slug, id, version })),
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
}
