/**
 * Centralized route segment constants for core framework routes.
 * Use these instead of hardcoding strings in routers.
 * 
 * Plugin-specific routes should be defined in their respective plugin directories.
 */
export class RouteConstants {
  static readonly SEGMENTS = {
  // ── Generic ──────────────────────────────────────────────────────────────
  ROOT: '/',

  // ── Top-level mount points ───────────────────────────────────────────────
  AUTH: '/auth',
  PLUGINS: '/plugins',
  MARKETPLACE: '/marketplace',
  THEMES: '/themes',
  APPEARANCES: '/appearances',
  APPEARANCES_CATALOG: '/catalog',
  APPEARANCES_INSTALL: '/install',
  APPEARANCES_SLUG: '/:slug',
  SYSTEM: '/system',
  MEDIA: '/media',
  /** Private-file delivery: the recipient-facing token routes and the operator's share management. */
  FILES: '/files',
  VERSIONS: '/versions',

  /** Websocket upgrade path served by the API alongside the HTTP routes. */
  WEBSOCKET: '/socket',

  // ── Admin ───────────────────────────────────────────────────────────────
  ADMIN_BASE: '/admin',
  HEALTH: '/health',
  READY: '/ready',

  // ── Account (frontend page slugs) ────────────────────────────────────────
  ACCOUNT: '/account',
  ACCOUNT_SECTION: '/account/:section',
  /** Self-service GDPR endpoints on the auth router (authenticated, act on the CURRENT user). */
  ACCOUNT_EXPORT: '/account/export',
  ACCOUNT_DELETE: '/account/delete',

  // ── SCIM 2.0 provisioning ────────────────────────────────────────────────
  /** Standard SCIM base, mounted under the versioned API prefix and authenticated by bearer token. */
  SCIM_BASE: '/scim/v2',

  // ── Core / Auth ───────────────────────────────────────────────────────────
  ACTIVE: '/active',
  ME: '/me',
  STATUS: '/status',
  ENABLE: '/enable',
  DISABLE: '/disable',
  SESSIONS: '/sessions',
  SESSIONS_ME: '/sessions/me',
  API_TOKENS: '/api-tokens',
  KILL: '/kill',
  SETUP: '/setup',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  RESEND_VERIFICATION: '/resend-verification',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ADMIN_SEND_PASSWORD_RESET: '/admin/send-password-reset',
  LOGIN: '/login',
  LOGOUT: '/logout',
  /** Tenants this account may enter, and switching between them (multi-tenant only). */
  TENANTS_AVAILABLE: '/tenants/available',
  TENANTS_SELECT: '/tenants/select',
  /** Public: whose console is this host (a workspace tenant), before anyone is signed in. */
  HOST_INFO: '/host',
  SSO_PROVIDERS: '/sso/providers',
  SSO_LOGIN: '/sso/login',
  SECURITY: '/security',
  PROFILE: '/profile',
  ME_PERSON: '/me/person',
  VERIFY_PASSWORD: '/verify-password',
  CHANGE_PASSWORD: '/change-password',
  EMAIL_CHANGE_REQUEST: '/email-change/request',
  EMAIL_CHANGE_CONFIRM: '/email-change/confirm',
  TWO_FACTOR_STATUS: '/2fa/status',
  TWO_FACTOR_SETUP: '/2fa/setup',
  TWO_FACTOR_VERIFY: '/2fa/verify',
  TWO_FACTOR_RECOVERY: '/2fa/recovery-codes/regenerate',
  TWO_FACTOR_DISABLE: '/2fa',
  SESSIONS_ID_REVOKE: '/sessions/:id/revoke',
  SESSIONS_REVOKE_OTHERS: '/sessions/revoke-others',
  API_TOKENS_ID: '/api-tokens/:id',
  SESSIONS_ID_KILL: '/sessions/:id/kill',
  ADMIN_METADATA: '/admin/metadata',
  ADMIN_SEARCH: '/admin/search',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  ADMIN_PREFERENCES_KEY: '/admin/preferences/:key',
  /** A person's own email-stream preferences. Session-scoped: never takes an address from the caller. */
  EMAIL_PREFERENCES: '/email-preferences',
  /**
   * The same surface for someone arriving from a link in an email rather than a session. PUBLIC by
   * necessity — most recipients have no account — and safe because the signed token is what names the
   * address; an address supplied by the caller is ignored.
   */
  EMAIL_PREFERENCES_BY_TOKEN: '/email-preferences/by-token',
  ADMIN_WEBHOOKS: '/admin/webhooks',
  ADMIN_WEBHOOKS_ID_TEST: '/admin/webhooks/:id/test',
  ADMIN_WEBHOOK_DELIVERIES_ID_RESEND: '/admin/webhook-deliveries/:id/resend',
  ADMIN_SCIM: '/admin/scim',
  ADMIN_SCIM_ROTATE: '/admin/scim/rotate',
  ADMIN_NOTIFICATIONS_ID_READ: '/admin/notifications/:id/read',
  ADMIN_NOTIFICATIONS_READ_ALL: '/admin/notifications/read-all',
  ADMIN_STATS_COLLECTIONS: '/admin/stats/collections',
  ADMIN_STATS_SECURITY: '/admin/stats/security',
  ADMIN_STATS_HOST: '/admin/stats/host',
  ADMIN_STATS_SCHEDULE: '/admin/stats/schedule',
  ADMIN_STATS_ATTENTION: '/admin/stats/attention',
  ADMIN_STATS_SITES: '/admin/stats/sites',
  ADMIN_STATS_RECENT_EDITS: '/admin/stats/recent-edits',
  ADMIN_STATS_INSTALLATION: '/admin/stats/installation',
  ADMIN_INTEGRATIONS: '/admin/integrations',
  ADMIN_INTEGRATIONS_TYPE: '/admin/integrations/:type',
  ADMIN_INTEGRATIONS_PROVIDER: '/admin/integrations/:type/providers/:providerId',
  ADMIN_INTEGRATIONS_PROFILE_ACTIVATE: '/admin/integrations/:type/profiles/:profileId/activate',
  ADMIN_INTEGRATIONS_PROFILE: '/admin/integrations/:type/profiles/:profileId',
  ADMIN_TELEMETRY_EMAIL_TEST: '/admin/telemetry/email-test',
  ADMIN_ACTIVITY: '/admin/activity',
  ADMIN_LOGS: '/admin/logs',
  ADMIN_AUDIT: '/admin/audit',
  /**
   * Tenant provisioning (T4). Mounted under SYSTEM; every route is platform-admin only. The `TENANTS_*`
   * entries are RELATIVE to the tenants router's root.
   */
  ADMIN_TENANTS: '/admin/tenants',
  TENANTS_ROOT: '/',
  TENANTS_ID: '/:id',
  TENANTS_ID_EXPORT: '/:id/export',
  TENANTS_ID_PAGES: '/:id/pages',
  TENANTS_ID_MEMBERS_LIST: '/:id/members',
  INTERNAL: '/internal',
  INTERNAL_ROUTING: '/internal/routing',
  /** Gateway-side: the api pushes here after a tenant change; the gateway answers its health here. */
  INTERNAL_ROUTING_RELOAD: '/internal/routing/reload',
  GATEWAY_HEALTH: '/healthz',
  TENANTS_ID_MEMBERS: '/:id/members',
  TENANTS_ID_MEMBERS_USER: '/:id/members/:userId',
  TENANTS_IMPORT_SESSION: '/import/session',
  TENANTS_IMPORT_CHUNK: '/import/chunk',
  TENANTS_IMPORT_PREVIEW: '/import/preview',
  TENANTS_IMPORT_EXECUTE: '/import/execute',
  TENANTS_ADOPT: '/adopt',
  ADMIN_BACKUPS: '/admin/backups',
  ADMIN_BACKUPS_CREATE_SYSTEM: '/admin/backups/system',
  ADMIN_BACKUPS_IMPORT: '/admin/backups/import',
  ADMIN_BACKUPS_IMPORT_SESSION: '/admin/backups/import/session',
  ADMIN_BACKUPS_IMPORT_CHUNK: '/admin/backups/import/chunk',
  ADMIN_BACKUPS_IMPORT_COMPLETE: '/admin/backups/import/complete',
  ADMIN_BACKUPS_ID: '/admin/backups/:id',
  ADMIN_BACKUPS_ID_DOWNLOAD: '/admin/backups/:id/download',
  ADMIN_BACKUPS_ID_RESTORE_PREVIEW: '/admin/backups/:id/restore/preview',
  ADMIN_BACKUPS_ID_RESTORE_EXECUTE: '/admin/backups/:id/restore/execute',
  ADMIN_SETTINGS: '/admin/settings',
  /** Which settings belong to the PLATFORM, and whether this account may change them. */
  ADMIN_SETTINGS_PLATFORM_KEYS: '/admin/settings/platform-keys',
  ADMIN_REDIRECTS: '/admin/redirects',
  ADMIN_REDIRECTS_ID: '/admin/redirects/:id',
  ADMIN_ROLES: '/admin/roles',
  ADMIN_ROLES_SLUG: '/admin/roles/:slug',
  ADMIN_PERMISSIONS: '/admin/permissions',
  ADMIN_USERS: '/admin/users',
  ADMIN_USERS_ID: '/admin/users/:id',
  ADMIN_USERS_OWNERSHIP: '/admin/users/:id/ownership',
  ADMIN_PEOPLE: '/admin/people',
  ADMIN_PEOPLE_RECORDS: '/admin/people/records',
  /** Recipient suggestions. Literal path — must be registered before ADMIN_PEOPLE_ID. */
  ADMIN_PEOPLE_SUGGEST: '/admin/people/suggest',
  ADMIN_PEOPLE_ID: '/admin/people/:id',
  ADMIN_PEOPLE_ID_CREATE_USER: '/admin/people/:id/create-user',
  ADMIN_PEOPLE_ID_LINK_USER: '/admin/people/:id/link-user',
  ADMIN_PEOPLE_ID_RECORDS: '/admin/people/:id/records',
  ADMIN_USERS_ROLES: '/admin/users/roles',
  ADMIN_USERS_2FA_STATUS: '/admin/users/:id/2fa/status',
  ADMIN_USERS_2FA_SETUP: '/admin/users/:id/2fa/setup',
  ADMIN_USERS_2FA_VERIFY: '/admin/users/:id/2fa/verify',
  ADMIN_USERS_2FA_RECOVERY: '/admin/users/:id/2fa/recovery-codes/regenerate',
  ADMIN_USERS_2FA_DISABLE: '/admin/users/:id/2fa',
  UPDATE_CHECK: '/update/check',
  UPDATE_APPLY: '/update/apply',
  /** Operator-triggered restart of one app of this deployment (api / admin / frontend). */
  DEPLOY_RESTART: '/deploy/restart',
  /** Which apps can be restarted here, and whether each one is reachable. */
  DEPLOY_APPS: '/deploy/apps',
  EVENTS: '/events',
  FRONTEND: '/frontend',
  I18N: '/i18n',
  WEBHOOKS: '/webhooks',
  SHORTCODES: '/shortcodes',
  SHORTCODES_RENDER: '/shortcodes/render',
  DATA_SOURCES: '/data-sources',
  DATA_SOURCES_CATALOG: '/datasources/catalog',
  DATA_SOURCES_OPTIONS: '/datasources/options',
  DATA_SOURCE_QUERY: '/data-source/query',
  RESOLVE: '/resolve',

  // ── Plugins ──────────────────────────────────────────────────────────────
  PLUGINS_MARKETPLACE: '/marketplace',
  PLUGINS_INSTALL: '/install/:slug',
  PLUGINS_UPDATE_ALL: '/update-all',
  PLUGINS_INSTALL_OPERATION: '/install-operations/:operationId',
  PLUGINS_UPLOAD_SESSION: '/upload/session',
  PLUGINS_UPLOAD_CHUNK: '/upload/chunk',
  PLUGINS_UPLOAD_SESSION_INSPECT: '/upload/session/inspect',
  PLUGINS_UPLOAD_INSPECT: '/upload/inspect',
  PLUGINS_UPLOAD_COMPLETE: '/upload/complete',
  PLUGINS_UPLOAD: '/upload',
  PLUGINS_REAPPROVE_ALL: '/reapprove-all',
  PLUGINS_HEALTH: '/health',
  PLUGINS_SLUG_TOGGLE: '/:slug/toggle',
  PLUGINS_SLUG_CONFIG: '/:slug/config',
  PLUGINS_SLUG_SANDBOX: '/:slug/sandbox',
  PLUGINS_SLUG_LOGS: '/:slug/logs',
  PLUGINS_SLUG_SETTINGS: '/:slug/settings',
  PLUGINS_SLUG_SETTINGS_SCHEMA: '/:slug/settings/schema',
  PLUGINS_SLUG_SETTINGS_RESET: '/:slug/settings/reset',
  PLUGINS_SLUG_SETTINGS_EXPORT: '/:slug/settings/export',
  PLUGINS_SLUG_SETTINGS_IMPORT: '/:slug/settings/import',
  PLUGINS_SLUG_UI_WILDCARD: '/:slug/ui/*assetPath',
  PLUGINS_SLUG: '/:slug',

  // ── Collections ──────────────────────────────────────────────────────────
  COLLECTIONS_SLUG: '/:slug',
  COLLECTIONS_SLUG_ID: '/:slug/:id',
  COLLECTIONS_SLUG_EXPORT: '/:slug/export',
  COLLECTIONS_SLUG_IMPORT: '/:slug/import',
  COLLECTIONS_SLUG_BULK: '/:slug/bulk',
  COLLECTIONS_SLUG_BULK_UPDATE: '/:slug/bulk-update',
  COLLECTIONS_SLUG_BULK_DELETE: '/:slug/bulk-delete',
  COLLECTIONS_SLUG_SUGGESTIONS_FIELD: '/:slug/suggestions/:field',
  COLLECTIONS_SLUG_ID_VERSION: '/:slug/:id/:version',
  COLLECTIONS_SLUG_ID_VERSION_RESTORE: '/:slug/:id/:version/restore',

  // ── Global Collections (prefixed with /collections) ──────────────────────
  GLOBAL_COLLECTIONS_SLUG: '/collections/:slug',
  GLOBAL_COLLECTIONS_SLUG_ID: '/collections/:slug/:id',
  GLOBAL_COLLECTIONS_SLUG_EXPORT: '/collections/:slug/export',
  GLOBAL_COLLECTIONS_SLUG_IMPORT: '/collections/:slug/import',
  GLOBAL_COLLECTIONS_SLUG_BULK: '/collections/:slug/bulk',
  GLOBAL_COLLECTIONS_SLUG_BULK_UPDATE: '/collections/:slug/bulk-update',
  GLOBAL_COLLECTIONS_SLUG_BULK_DELETE: '/collections/:slug/bulk-delete',
  GLOBAL_COLLECTIONS_SLUG_SUGGESTIONS_FIELD: '/collections/:slug/suggestions/:field',

  // ── Themes ──────────────────────────────────────────────────────────────
  THEMES_UPLOAD_SESSION: '/upload/session',
  THEMES_UPLOAD_CHUNK: '/upload/chunk',
  THEMES_UPLOAD_SESSION_INSPECT: '/upload/session/inspect',
  THEMES_UPLOAD_INSPECT: '/upload/inspect',
  THEMES_UPLOAD_COMPLETE: '/upload/complete',
  THEMES_UPLOAD: '/upload',
  THEMES_SLUG_ACTIVATE: '/:slug/activate',
  THEMES_SLUG_DISABLE: '/:slug/disable',
  THEMES_SLUG_RESET: '/:slug/reset',
  THEMES_SLUG_INSTALL: '/:slug/install',
  THEMES_SLUG_CONFIG: '/:slug/config',
  THEMES_SLUG_CHECK_UPDATE: '/:slug/check-update',
  THEMES_SLUG_PUBLIC_WILDCARD: '/:slug/public/*assetPath',
  THEMES_SLUG_UI_WILDCARD: '/:slug/ui/*assetPath',
  THEMES_ACTIVE_ASSETS: '/active/assets',
  THEMES_SLUG: '/:slug',

  // ── Media ───────────────────────────────────────────────────────────────
  MEDIA_UPLOAD: '/upload',
  MEDIA_FOLDERS: '/folders',
  MEDIA_FOLDERS_ID: '/folders/:id',
  MEDIA_FOLDERS_ID_PATH: '/folders/:id/path',
  MEDIA_ID: '/:id',
  MEDIA_ID_OPTIMIZE: '/:id/optimize',
  MEDIA_ID_RAW: '/:id/raw',
  // MEDIA_BASE: '/' is implicitly handled by the router mount point or just ''

  // ── Private file delivery ───────────────────────────────────────────────
  // Literal paths FIRST in the router: `/:token` matches any single segment and would otherwise
  // swallow every one of these.
  FILES_SHARES: '/shares',
  FILES_SHARE_ID: '/shares/:shareId',
  FILES_SHARE_GRANTS: '/shares/:shareId/grants',
  FILES_GRANT_ID: '/grants/:grantId',
  /** Activity across EVERY share — the operator's view of what the log records. */
  FILES_ACTIVITY: '/activity',
  /** What actually happened to a share — opens, downloads and refusals from the access log. */
  FILES_SHARE_ACTIVITY: '/shares/:shareId/activity',
  /** Who can currently open one file — sharing is done FROM the file, so this is the question asked. */
  FILES_MEDIA_GRANTS: '/media/:mediaId/grants',
  FILES_MY_SHARES: '/my/shares',
  FILES_MY_DOWNLOAD: '/my/shares/:shareId/download/:mediaId',
  FILES_TOKEN: '/:token',
  FILES_TOKEN_DOWNLOAD: '/:token/download/:mediaId',
  } as const;

  /**
   * The auth routes that carry NO `auth.guard()` — the ones a visitor with no session, or a session
   * the server will not accept, must still be able to reach.
   *
   * They read no tenant rows, so admin tenancy has nothing to decide for them, and refusing them on
   * a tenancy verdict locks an operator out of the only screens that could fix the session. That is
   * not hypothetical: on a workspace domain, an account holding a valid session but no membership
   * there had EVERY admin-client request answered `403 tenant_access_revoked` — including `/login`,
   * so it could not sign in as somebody else, and `/host`, so the console could not even find out
   * whose domain it was standing on.
   *
   * Kept in step with `AuthRouter.registerRoutes` by `auth-public-segments.test.ts`, which fails if a
   * route here is guarded or a guardless route is missing from this list.
   */
  static readonly AUTH_PUBLIC_SEGMENTS: readonly string[] = [
    RouteConstants.SEGMENTS.STATUS,
    RouteConstants.SEGMENTS.SETUP,
    RouteConstants.SEGMENTS.REGISTER,
    RouteConstants.SEGMENTS.VERIFY_EMAIL,
    RouteConstants.SEGMENTS.RESEND_VERIFICATION,
    RouteConstants.SEGMENTS.FORGOT_PASSWORD,
    RouteConstants.SEGMENTS.RESET_PASSWORD,
    RouteConstants.SEGMENTS.SSO_PROVIDERS,
    RouteConstants.SEGMENTS.SSO_LOGIN,
    RouteConstants.SEGMENTS.LOGIN,
    RouteConstants.SEGMENTS.LOGOUT,
    RouteConstants.SEGMENTS.HOST_INFO,
    RouteConstants.SEGMENTS.EMAIL_CHANGE_CONFIRM,
  ];
}
