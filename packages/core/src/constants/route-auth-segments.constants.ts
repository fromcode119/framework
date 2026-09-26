/**
 * The auth router's own segments — login, session, SSO, password and email-change flows.
 *
 * The largest single group by far, and the one with the most rules written into its comments, so it
 * gets its own file. Reached as `RouteConstants.SEGMENTS.*` exactly as before.
 */
export class RouteAuthSegments {
  static readonly ALL = {
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
  /**
   * The first-run wizard's OWN routes, answered before there is a database.
   *
   * Deliberately not under `/auth`: these are the only two endpoints a deployment with no connection
   * string can serve, and an unconfigured process has no auth to hang them off. `SETUP` above is the
   * separate, database-backed call that creates the administrator once one exists.
   */
  SETUP_STATUS: '/setup/status',
  SETUP_DATABASE: '/setup/database',
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
  /** Step out of every site into the platform scope. Platform admins only — see `leaveTenant`. */
  TENANTS_LEAVE: '/tenants/leave',
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
  /**
   * Letting a site's own people look at it before it is published.
   *
   * NOT under `/admin`, deliberately: only half of this lives on the admin surface. The mint does,
   * and is guarded; the exchange is requested by the operator's BROWSER on the site's own host,
   * where there is no admin session to guard it with — the one-time token in the path is the whole
   * credential. `SITE_PREVIEW_*` are RELATIVE to the router's root.
   */
  SITE_PREVIEW: '/site-preview',
  /** Mint: the admin asks for a link to a site it administers. */
  SITE_PREVIEW_SESSION: '/:id/session',
  /** Spend: the browser arrives on the site's own host with the token and leaves with a cookie. */
  SITE_PREVIEW_EXCHANGE: '/exchange/:token',
  TENANTS_ROOT: '/',
  /** `/system/admin/certificates` — the platform-wide TLS certificate list and its uploads. */
  ADMIN_CERTIFICATES: '/admin/certificates',
  /** One host's certificate. A hostname is a safe path segment; the store normalises what arrives. */
  CERTIFICATES_HOST: '/:host',
  /** Who is responsible for a host's certificate — the operator, or the platform. */
  CERTIFICATES_HOST_SOURCE: '/:host/source',
  /**
   * What this platform's own hostnames resolve to, offered as a suggestion for the addresses
   * setting. Its own route rather than part of the overview: the overview runs on every load of the
   * certificates page and must not pay for DNS lookups.
   */
  CERTIFICATES_PLATFORM_ADDRESSES: '/platform-addresses',
  /** Store or clear the Cloudflare API token DNS-01/wildcard orders use. Never returns the value. */
  CERTIFICATES_CLOUDFLARE_TOKEN: '/cloudflare-token',
  TENANTS_ID: '/:id',
  TENANTS_ID_EXPORT: '/:id/export',
  TENANTS_ID_PAGES: '/:id/pages',
  TENANTS_ID_MEMBERS_LIST: '/:id/members',
  INTERNAL: '/internal',
  INTERNAL_ROUTING: '/internal/routing',
  /** 'Is this host one of yours?' — what an edge asks before it issues a certificate for it. */
  INTERNAL_HOST_PERMIT: '/internal/hosts/permit',
  /**
   * The certificates and PRIVATE KEYS whatever terminates TLS loads at start.
   *
   * The only route that hands out key material, so it carries the strictest rule in the platform:
   * it must never be published through the edge, and it answers nothing without the internal secret.
   */
  INTERNAL_CERTIFICATES: '/internal/certificates',
  /**
   * Where a certificate authority asks us to prove a host is ours. Fixed by the ACME protocol, and
   * served over PLAIN HTTP at the ROOT of the host — not under the api's versioned base, because the
   * authority requests exactly this path and nothing else.
   */
  ACME_CHALLENGE: '/.well-known/acme-challenge',
  /**
   * What a crawler is told about the PLATFORM's own hosts (the console and the api host).
   *
   * At the ROOT of the host, not under the api's versioned base, because a crawler requests exactly
   * this path. A site's own `robots.txt` is a different thing entirely — it is served per tenant by
   * the storefront and reaches the api under `api/v1/plugins/<slug>/...`, never here.
   */
  ROBOTS: '/robots.txt',
  /** Gateway-side: the api pushes here after a tenant change; the gateway answers its health here. */
  INTERNAL_ROUTING_RELOAD: '/internal/routing/reload',
  GATEWAY_HEALTH: '/healthz',
  TENANTS_ID_MEMBERS: '/:id/members',
  TENANTS_ID_MEMBERS_USER: '/:id/members/:userId',
  TENANTS_IMPORT_SESSION: '/import/session',
  TENANTS_IMPORT_CHUNK: '/import/chunk',
  TENANTS_IMPORT_PREVIEW: '/import/preview',
  TENANTS_IMPORT_EXECUTE: '/import/execute',
  TENANTS_IMPORT_STANDALONE: '/import/standalone',
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
  /** Every personal-data dataset with the policy in force for it, and which layer decided. */
  ADMIN_PERSONAL_DATA_POLICY: '/admin/personal-data/policy',
  ADMIN_REDIRECTS: '/admin/redirects',
  ADMIN_REDIRECTS_ID: '/admin/redirects/:id',
  ADMIN_ROLES: '/admin/roles',
  ADMIN_ROLES_SLUG: '/admin/roles/:slug',
  ADMIN_PERMISSIONS: '/admin/permissions',
  ADMIN_USERS: '/admin/users',
  ADMIN_USERS_ID: '/admin/users/:id',
  ADMIN_USERS_OWNERSHIP: '/admin/users/:id/ownership',
  /** Records RELATED to one record, rather than owned by one person. Subject-keyed, not people-keyed. */
  ADMIN_RECORD_LINKS: '/admin/record-links',
  /** Which plugin's design a storefront page shows while its content is empty. */
  ADMIN_PAGE_DESIGN: '/admin/page-design',
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
  /** The stored deploy mode and whether this box has room for a rolling deploy right now. */
  DEPLOY_CAPACITY: '/deploy/capacity',
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
  } as const;
}
