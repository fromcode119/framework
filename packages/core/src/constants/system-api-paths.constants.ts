import { RouteConstants } from '@core/constants/route.constants';

/**
 * Every API path the framework serves, built from the shared route segments.
 *
 * Split out of `SystemConstants` for size; reached as `SystemApiPaths.API_PATH.*` exactly as before.
 * The segment bases live here with the paths that use them — they were private helpers on
 * `SystemConstants` that nothing else read.
 */
export class SystemApiPaths {
  private static readonly ROUTE_SEGMENTS = RouteConstants.SEGMENTS;
  private static readonly AUTH_BASE = SystemApiPaths.ROUTE_SEGMENTS.AUTH;
  private static readonly SYSTEM_BASE = SystemApiPaths.ROUTE_SEGMENTS.SYSTEM;
  private static readonly PLUGINS_BASE = SystemApiPaths.ROUTE_SEGMENTS.PLUGINS;
  private static readonly THEMES_BASE = SystemApiPaths.ROUTE_SEGMENTS.THEMES;
  private static readonly MEDIA_BASE = SystemApiPaths.ROUTE_SEGMENTS.MEDIA;
  private static readonly FILES_BASE = SystemApiPaths.ROUTE_SEGMENTS.FILES;
  private static readonly VERSIONS_BASE = SystemApiPaths.ROUTE_SEGMENTS.VERSIONS;
  private static readonly COLLECTIONS_BASE = '/collections';
  private static readonly SOURCES_BASE = SystemApiPaths.ROUTE_SEGMENTS.SOURCES;
  private static readonly joinPath = (base: string, segment: string): string => `${base}${segment}`;

  static readonly ALL = {
    /**
     * Sources, the framework's repository-tracking surface.
     *
     * The per-source routes take a kind and a slug, so their SUFFIXES are published rather than whole
     * paths — the caller encodes the two values and appends. Everything here composes from the same
     * segments the router mounts, so the two cannot drift.
     */
    SOURCES: {
      BASE: SystemApiPaths.SOURCES_BASE,
      PROVIDERS: SystemApiPaths.joinPath(SystemApiPaths.SOURCES_BASE, SystemApiPaths.ROUTE_SEGMENTS.SOURCES_PROVIDERS),
      BUILD_ALL: SystemApiPaths.joinPath(SystemApiPaths.SOURCES_BASE, SystemApiPaths.ROUTE_SEGMENTS.SOURCES_BUILD),
      CHECK_UPDATES: SystemApiPaths.joinPath(SystemApiPaths.SOURCES_BASE, SystemApiPaths.ROUTE_SEGMENTS.SOURCES_CHECK_UPDATES),
      BRANCHES: SystemApiPaths.joinPath(SystemApiPaths.SOURCES_BASE, SystemApiPaths.ROUTE_SEGMENTS.SOURCES_BRANCHES),
      INSPECT: SystemApiPaths.joinPath(SystemApiPaths.SOURCES_BASE, SystemApiPaths.ROUTE_SEGMENTS.SOURCES_INSPECT),
      /** Appended to `<BASE>/<kind>/<slug>` by the caller, which owns the encoding. */
      BUILD_SUFFIX: SystemApiPaths.ROUTE_SEGMENTS.SOURCES_BUILD,
      PACKAGE_SUFFIX: SystemApiPaths.ROUTE_SEGMENTS.SOURCES_PACKAGE,
      VERSIONS_SUFFIX: SystemApiPaths.ROUTE_SEGMENTS.VERSIONS,
      INSTALL_SUFFIX: SystemApiPaths.ROUTE_SEGMENTS.SOURCES_INSTALL,
    },
    /**
     * The first-run wizard. Both of these are answered by an UNCONFIGURED process too — they are what
     * a deployment that has not been told where its database is can still serve.
     */
    SETUP: {
      STATUS: SystemApiPaths.ROUTE_SEGMENTS.SETUP_STATUS,
      DATABASE: SystemApiPaths.ROUTE_SEGMENTS.SETUP_DATABASE,
    },
    AUTH: {
      BASE: SystemApiPaths.AUTH_BASE,
      STATUS: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.STATUS),
      HOST_INFO: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.HOST_INFO),
      TENANTS_AVAILABLE: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TENANTS_AVAILABLE),
      TENANTS_SELECT: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TENANTS_SELECT),
      TENANTS_LEAVE: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TENANTS_LEAVE),
      SETUP: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SETUP),
      LOGIN: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.LOGIN),
      LOGOUT: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.LOGOUT),
      REGISTER: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.REGISTER),
      VERIFY_EMAIL: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.VERIFY_EMAIL),
      RESEND_VERIFICATION: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.RESEND_VERIFICATION),
      FORGOT_PASSWORD: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.FORGOT_PASSWORD),
      RESET_PASSWORD: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.RESET_PASSWORD),
      ADMIN_SEND_PASSWORD_RESET: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_SEND_PASSWORD_RESET),
      VERIFY_PASSWORD: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.VERIFY_PASSWORD),
      PROFILE: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.PROFILE),
      CHANGE_PASSWORD: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.CHANGE_PASSWORD),
      SECURITY: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SECURITY),
      EMAIL_CHANGE_REQUEST: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.EMAIL_CHANGE_REQUEST),
      EMAIL_CHANGE_CONFIRM: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.EMAIL_CHANGE_CONFIRM),
      TWO_FACTOR_STATUS: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_STATUS),
      TWO_FACTOR_SETUP: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_SETUP),
      TWO_FACTOR_VERIFY: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_VERIFY),
      TWO_FACTOR_RECOVERY_REGENERATE: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_RECOVERY),
      TWO_FACTOR_DISABLE: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_DISABLE),
      SSO_PROVIDERS: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SSO_PROVIDERS),
      SSO_LOGIN: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SSO_LOGIN),
      SESSIONS: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SESSIONS),
      MY_SESSIONS: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SESSIONS_ME),
      REVOKE_SESSION: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SESSIONS_ID_REVOKE),
      REVOKE_OTHER_SESSIONS: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SESSIONS_REVOKE_OTHERS),
      KILL_SESSION: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SESSIONS_ID_KILL),
      API_TOKENS: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.API_TOKENS),
      API_TOKEN: SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.API_TOKENS_ID),
      ACCOUNT_SELF_SERVICE: [
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SECURITY),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.PROFILE),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.CHANGE_PASSWORD),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.EMAIL_CHANGE_REQUEST),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SESSIONS_ME),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.SESSIONS_REVOKE_OTHERS),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_STATUS),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_SETUP),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_VERIFY),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_RECOVERY),
        SystemApiPaths.joinPath(SystemApiPaths.AUTH_BASE, SystemApiPaths.ROUTE_SEGMENTS.TWO_FACTOR_DISABLE),
      ] as const
    },
    SYSTEM: {
      BASE: SystemApiPaths.SYSTEM_BASE,
      HEALTH: SystemApiPaths.ROUTE_SEGMENTS.HEALTH,
      STATUS: SystemApiPaths.ROUTE_SEGMENTS.STATUS,
      FRONTEND: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.FRONTEND),
      ADMIN_TENANTS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS),
      SITE_PREVIEW: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.SITE_PREVIEW),
      SITE_PREVIEW_SESSION: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.SITE_PREVIEW}${SystemApiPaths.ROUTE_SEGMENTS.SITE_PREVIEW_SESSION}`),
      SITE_PREVIEW_EXCHANGE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.SITE_PREVIEW}${SystemApiPaths.ROUTE_SEGMENTS.SITE_PREVIEW_EXCHANGE}`),
      ADMIN_CERTIFICATES: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_CERTIFICATES),
      ADMIN_CERTIFICATE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_CERTIFICATES}${SystemApiPaths.ROUTE_SEGMENTS.CERTIFICATES_HOST}`),
      ADMIN_CERTIFICATE_SOURCE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_CERTIFICATES}${SystemApiPaths.ROUTE_SEGMENTS.CERTIFICATES_HOST_SOURCE}`),
      ADMIN_CERTIFICATE_CLOUDFLARE_TOKEN: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_CERTIFICATES}${SystemApiPaths.ROUTE_SEGMENTS.CERTIFICATES_CLOUDFLARE_TOKEN}`),
      ADMIN_TENANT: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_ID}`),
      ADMIN_TENANT_EXPORT: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_ID_EXPORT}`),
      ADMIN_TENANT_PAGES: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_ID_PAGES}`),
      ADMIN_TENANT_MEMBERS_LIST: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_ID_MEMBERS_LIST}`),
      ADMIN_TENANT_MEMBERS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_ID_MEMBERS}`),
      ADMIN_TENANT_MEMBER: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_ID_MEMBERS_USER}`),
      ADMIN_TENANTS_IMPORT_SESSION: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_IMPORT_SESSION}`),
      ADMIN_TENANTS_IMPORT_CHUNK: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_IMPORT_CHUNK}`),
      ADMIN_TENANTS_IMPORT_PREVIEW: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_IMPORT_PREVIEW}`),
      ADMIN_TENANTS_IMPORT_EXECUTE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_IMPORT_EXECUTE}`),
      ADMIN_TENANTS_IMPORT_STANDALONE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_IMPORT_STANDALONE}`),
      ADMIN_TENANTS_ADOPT: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, `${SystemApiPaths.ROUTE_SEGMENTS.ADMIN_TENANTS}${SystemApiPaths.ROUTE_SEGMENTS.TENANTS_ADOPT}`),
      ADMIN_SETTINGS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_SETTINGS),
      ADMIN_SETTINGS_PLATFORM_KEYS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_SETTINGS_PLATFORM_KEYS),
      ADMIN_REDIRECTS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_REDIRECTS),
      ADMIN_REDIRECT: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_REDIRECTS_ID),
      ADMIN_BACKUPS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS),
      ADMIN_BACKUP: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID),
      ADMIN_BACKUP_CREATE_SYSTEM: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_CREATE_SYSTEM),
      ADMIN_BACKUP_IMPORT: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT),
      ADMIN_BACKUP_IMPORT_SESSION: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT_SESSION),
      ADMIN_BACKUP_IMPORT_CHUNK: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT_CHUNK),
      ADMIN_BACKUP_IMPORT_COMPLETE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT_COMPLETE),
      ADMIN_BACKUP_DOWNLOAD: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID_DOWNLOAD),
      ADMIN_BACKUP_RESTORE_PREVIEW: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_PREVIEW),
      ADMIN_BACKUP_RESTORE_EXECUTE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_EXECUTE),
      ADMIN_USERS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_USERS),
      ADMIN_USER: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_USERS_ID),
      ADMIN_PEOPLE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_PEOPLE),
      ADMIN_PEOPLE_ID: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_PEOPLE_ID),
      ADMIN_PEOPLE_CREATE_USER: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_PEOPLE_ID_CREATE_USER),
      ADMIN_PEOPLE_ID_RECORDS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_PEOPLE_ID_RECORDS),
      ADMIN_PEOPLE_RECORDS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_PEOPLE_RECORDS),
      ADMIN_PEOPLE_SUGGEST: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_PEOPLE_SUGGEST),
      RESOLVE: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.RESOLVE),
      I18N: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.I18N),
      EVENTS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.EVENTS),
      SHORTCODES: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.SHORTCODES),
      SHORTCODES_RENDER: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.SHORTCODES_RENDER),
      DEPLOY_RESTART: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.DEPLOY_RESTART),
      DEPLOY_APPS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.DEPLOY_APPS),
      ADMIN_PLUGINS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_METADATA),
      ADMIN_STATS: SystemApiPaths.joinPath(SystemApiPaths.SYSTEM_BASE, SystemApiPaths.ROUTE_SEGMENTS.ADMIN_STATS_COLLECTIONS),
      OPENAPI: '/openapi.json',
      DOCS: '/docs'
    },
    COLLECTIONS: {
      SETTINGS: `${SystemApiPaths.COLLECTIONS_BASE}/settings`,
      BASE: SystemApiPaths.COLLECTIONS_BASE,
      ITEM: SystemApiPaths.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG,
      DETAIL: SystemApiPaths.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_ID,
      // `:slug`-templated action routes (fill via ApiPathUtils.fillPath) so callers never hardcode the
      // `/import`, `/export`, `/bulk-*` suffixes.
      EXPORT: SystemApiPaths.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_EXPORT,
      IMPORT: SystemApiPaths.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_IMPORT,
      BULK_UPDATE: SystemApiPaths.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_BULK_UPDATE,
      BULK_DELETE: SystemApiPaths.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_BULK_DELETE,
      SUGGESTIONS: SystemApiPaths.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_SUGGESTIONS_FIELD
    },
    PLUGINS: {
      BASE: SystemApiPaths.PLUGINS_BASE,
      ACTIVE: SystemApiPaths.joinPath(SystemApiPaths.PLUGINS_BASE, SystemApiPaths.ROUTE_SEGMENTS.ACTIVE),
      UI: SystemApiPaths.joinPath(SystemApiPaths.PLUGINS_BASE, SystemApiPaths.ROUTE_SEGMENTS.PLUGINS_SLUG_UI_WILDCARD),
      TOGGLE: SystemApiPaths.joinPath(SystemApiPaths.PLUGINS_BASE, SystemApiPaths.ROUTE_SEGMENTS.PLUGINS_SLUG_TOGGLE),
      CONFIG: SystemApiPaths.joinPath(SystemApiPaths.PLUGINS_BASE, SystemApiPaths.ROUTE_SEGMENTS.PLUGINS_SLUG_CONFIG),
      DELETE: SystemApiPaths.joinPath(SystemApiPaths.PLUGINS_BASE, SystemApiPaths.ROUTE_SEGMENTS.PLUGINS_SLUG),
      MARKETPLACE: SystemApiPaths.joinPath(SystemApiPaths.ROUTE_SEGMENTS.MARKETPLACE, SystemApiPaths.PLUGINS_BASE),
      INSTALL: SystemApiPaths.joinPath(SystemApiPaths.PLUGINS_BASE, SystemApiPaths.ROUTE_SEGMENTS.PLUGINS_INSTALL)
    },
    THEMES: {
      BASE: SystemApiPaths.THEMES_BASE,
      PUBLIC: SystemApiPaths.joinPath(SystemApiPaths.THEMES_BASE, SystemApiPaths.ROUTE_SEGMENTS.THEMES_SLUG_PUBLIC_WILDCARD),
      UI: SystemApiPaths.joinPath(SystemApiPaths.THEMES_BASE, SystemApiPaths.ROUTE_SEGMENTS.THEMES_SLUG_UI_WILDCARD),
      MARKETPLACE: SystemApiPaths.joinPath(SystemApiPaths.THEMES_BASE, SystemApiPaths.ROUTE_SEGMENTS.PLUGINS_MARKETPLACE),
      DISABLE: SystemApiPaths.joinPath(SystemApiPaths.THEMES_BASE, SystemApiPaths.ROUTE_SEGMENTS.THEMES_SLUG_DISABLE)
    },
    MEDIA: {
      BASE: SystemApiPaths.MEDIA_BASE,
      UPLOAD: SystemApiPaths.joinPath(SystemApiPaths.MEDIA_BASE, SystemApiPaths.ROUTE_SEGMENTS.MEDIA_UPLOAD),
      /** An admin's own view of a file's bytes, whatever storage space it lives in. */
      ID_RAW: SystemApiPaths.joinPath(SystemApiPaths.MEDIA_BASE, SystemApiPaths.ROUTE_SEGMENTS.MEDIA_ID_RAW)
    },
    FILES: {
      BASE: SystemApiPaths.FILES_BASE,
      SHARES: SystemApiPaths.joinPath(SystemApiPaths.FILES_BASE, SystemApiPaths.ROUTE_SEGMENTS.FILES_SHARES),
      SHARE: SystemApiPaths.joinPath(SystemApiPaths.FILES_BASE, SystemApiPaths.ROUTE_SEGMENTS.FILES_SHARE_ID),
      SHARE_GRANTS: SystemApiPaths.joinPath(SystemApiPaths.FILES_BASE, SystemApiPaths.ROUTE_SEGMENTS.FILES_SHARE_GRANTS),
      GRANT: SystemApiPaths.joinPath(SystemApiPaths.FILES_BASE, SystemApiPaths.ROUTE_SEGMENTS.FILES_GRANT_ID),
      MEDIA_GRANTS: SystemApiPaths.joinPath(SystemApiPaths.FILES_BASE, SystemApiPaths.ROUTE_SEGMENTS.FILES_MEDIA_GRANTS),
      SHARE_ACTIVITY: SystemApiPaths.joinPath(SystemApiPaths.FILES_BASE, SystemApiPaths.ROUTE_SEGMENTS.FILES_SHARE_ACTIVITY),
      ACTIVITY: SystemApiPaths.joinPath(SystemApiPaths.FILES_BASE, SystemApiPaths.ROUTE_SEGMENTS.FILES_ACTIVITY)
    },
    VERSIONS: {
      BASE: SystemApiPaths.VERSIONS_BASE,
      ITEM: SystemApiPaths.joinPath(SystemApiPaths.VERSIONS_BASE, SystemApiPaths.ROUTE_SEGMENTS.COLLECTIONS_SLUG_ID),
      RESTORE: SystemApiPaths.joinPath(SystemApiPaths.VERSIONS_BASE, SystemApiPaths.ROUTE_SEGMENTS.COLLECTIONS_SLUG_ID_VERSION_RESTORE)
    }
  } as const;
}
