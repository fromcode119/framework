import { AppPathConstants } from '@core/constants/app-path.constants';
import { RouteConstants } from '@core/constants/route.constants';

/**
 * System-reserved database tables.
 * Plugins should use these names instead of hardcoded strings.
 */
export class SystemConstants {
  private static readonly ROUTE_SEGMENTS = RouteConstants.SEGMENTS;
  private static readonly AUTH_BASE = SystemConstants.ROUTE_SEGMENTS.AUTH;
  private static readonly SYSTEM_BASE = SystemConstants.ROUTE_SEGMENTS.SYSTEM;
  private static readonly PLUGINS_BASE = SystemConstants.ROUTE_SEGMENTS.PLUGINS;
  private static readonly THEMES_BASE = SystemConstants.ROUTE_SEGMENTS.THEMES;
  private static readonly MEDIA_BASE = SystemConstants.ROUTE_SEGMENTS.MEDIA;
  private static readonly VERSIONS_BASE = SystemConstants.ROUTE_SEGMENTS.VERSIONS;
  private static readonly COLLECTIONS_BASE = '/collections';
  private static readonly joinPath = (base: string, segment: string): string => `${base}${segment}`;

  static readonly TABLE = {
    USERS: 'users',
    ROLES: '_system_roles',
    PERMISSIONS: '_system_permissions',
    PLUGINS: '_system_plugins',
    PLUGIN_SETTINGS: '_system_plugin_settings',
    THEMES: '_system_themes',
    SESSIONS: '_system_sessions',
    LOGS: '_system_logs',
    AUDIT_LOGS: '_system_audit_logs',
    NOTIFICATIONS: '_system_notifications',
    WEBHOOK_DELIVERIES: '_system_webhook_deliveries',
    META: '_system_meta',
    MEDIA: 'media',
    MEDIA_FOLDERS: 'media_folders',
    RECORD_VERSIONS: '_system_record_versions',
    WEBHOOKS: '_system_webhooks',
    SCHEDULER_TASKS: '_system_scheduler_tasks',
    USERS_ROLES: '_system_users_roles',
    MIGRATIONS: '_system_migrations',
    PEOPLE: 'people',
    PERSON_RELATIONSHIPS: 'person_relationships',
    PEOPLE_ADDRESSES: 'people_addresses',
    PERSON_CATALOGS: 'person_catalogs'
  } as const;

  /**
   * Well-known keys in the system meta table.
   */
  static readonly META_KEY = {
  EMAIL_PROFILES: 'integration_email_profiles',
  EMAIL_PROVIDER: 'integration_email_provider',

  MAINTENANCE_MODE: 'maintenance_mode',
  SETUP_COMPLETED: 'setup_completed',
  SITE_NAME: 'site_name',
  SITE_URL: 'site_url',
  FRONTEND_URL: 'frontend_url',
  ADMIN_URL: 'admin_url',
  MARKETPLACE_URL: 'marketplace_url',
  DOMAIN_ALIASES: 'domain_aliases',
  TIMEZONE: 'timezone',
  ADMIN_APPEARANCE: 'admin_appearance',
  /** Whether admin surfaces render elevated (shadows) or flat. Absent = elevated. */
  ADMIN_SHADOWS: 'admin_shadows',
  PLATFORM_NAME: 'platform_name',
  PLATFORM_DOMAIN: 'platform_domain',
  TELEMETRY_ENABLED: 'telemetry_enabled',
  
  // Localization
  LOCALIZATION_LOCALES: 'localization_locales',
  ENABLED_LOCALES: 'enabled_locales',
  DEFAULT_LOCALE: 'default_locale',
  FALLBACK_LOCALE: 'fallback_locale',
  ADMIN_DEFAULT_LOCALE: 'admin_default_locale',
  FRONTEND_DEFAULT_LOCALE: 'frontend_default_locale',
  LOCALE_URL_STRATEGY: 'locale_url_strategy',
  // Platform-wide measurement system (metric cm/kg | imperial in/lb). A regional format like locale —
  // domain plugins (e.g. ecommerce package dimensions) read it; the framework stays domain-agnostic.
  MEASUREMENT_SYSTEM: 'measurement_system',
  
  // Security & Auth
  AUTH_SECURITY_NOTIFICATIONS: 'auth_security_notifications',
  AUTH_SESSION_DURATION: 'auth_session_duration_minutes',
  AUTH_PASSWORD_MIN_LENGTH: 'auth_password_min_length',
  AUTH_PASSWORD_REQUIRE_UPPERCASE: 'auth_password_require_uppercase',
  AUTH_PASSWORD_REQUIRE_LOWERCASE: 'auth_password_require_lowercase',
  AUTH_PASSWORD_REQUIRE_NUMBER: 'auth_password_require_number',
  AUTH_PASSWORD_REQUIRE_SYMBOL: 'auth_password_require_symbol',
  AUTH_PASSWORD_HISTORY: 'auth_password_history',
  AUTH_PASSWORD_BREACH_CHECK: 'auth_password_breach_check',
  AUTH_PASSWORD_RESET_TOKEN_MINUTES: 'auth_password_reset_token_minutes',
  AUTH_EMAIL_CHANGE_TOKEN_MINUTES: 'auth_email_change_token_minutes',
  AUTH_LOCKOUT_THRESHOLD: 'auth_lockout_threshold',
  AUTH_LOCKOUT_WINDOW_MINUTES: 'auth_lockout_window_minutes',
  AUTH_LOCKOUT_DURATION_MINUTES: 'auth_lockout_duration_minutes',
  AUTH_CAPTCHA_ENABLED: 'auth_captcha_enabled',
  AUTH_CAPTCHA_THRESHOLD: 'auth_captcha_threshold',
  TWO_FACTOR_ENABLED: 'two_factor_enabled',
  RATE_LIMIT_MAX: 'rate_limit_max',
  /**
   * Budget for TOKEN-BEARING requests, which are keyed per ip+token rather than per IP. One admin page
   * load fans out dozens of plugin API calls, so the anonymous cap throttles the whole admin behind a
   * shared proxy IP. Declared, seeded and editable in admin Settings → Security like every other
   * setting — it must never be an undeclared magic number in the limiter.
   */
  RATE_LIMIT_MAX_AUTHENTICATED: 'rate_limit_max_authenticated',
  /**
   * Budget for INTERNAL SERVER-TO-SERVER requests, keyed per calling service address.
   *
   * Every storefront page render fetches this API from ONE frontend container, anonymously — so all
   * SSR traffic for all visitors shared the single strict anonymous IP bucket and `/system/resolve`
   * started answering 429 under ordinary crawler load, which the storefront can only serve as a 5xx.
   * Internal callers are recognised by {@link RATE_LIMIT_INTERNAL_CLIENTS}, never by a header a
   * public client could send.
   */
  RATE_LIMIT_MAX_INTERNAL: 'rate_limit_max_internal',
  /**
   * The network addresses / CIDR blocks internal services call this API from (the frontend renderer,
   * workers). Seeded with loopback + the RFC1918 ranges a container network hands out; an operator
   * can narrow it to a single address or clear it, in which case NOTHING is internal and every
   * anonymous caller falls back to {@link RATE_LIMIT_MAX}.
   */
  RATE_LIMIT_INTERNAL_CLIENTS: 'rate_limit_internal_clients',
  RATE_LIMIT_WINDOW: 'rate_limit_window',
  
  // Routing & Features
  PERMALINK_STRUCTURE: 'permalink_structure',
  ROUTING_HOME_TARGET: 'routing_home_target',
  FRONTEND_AUTH_ENABLED: 'frontend_auth_enabled',
  FRONTEND_REGISTRATION_ENABLED: 'frontend_registration_enabled',
  EMAIL_NOTIFICATIONS: 'email_notifications',
  NOTIFICATION_EMAIL: 'notification_email',
  NOTIFICATION_EMAIL_CC: 'notification_email_cc'
  } as const;

  static readonly API_PATH = {
  AUTH: {
    BASE: SystemConstants.AUTH_BASE,
    STATUS: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.STATUS),
    SETUP: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SETUP),
    LOGIN: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.LOGIN),
    LOGOUT: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.LOGOUT),
    REGISTER: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.REGISTER),
    VERIFY_EMAIL: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.VERIFY_EMAIL),
    RESEND_VERIFICATION: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.RESEND_VERIFICATION),
    FORGOT_PASSWORD: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.FORGOT_PASSWORD),
    RESET_PASSWORD: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.RESET_PASSWORD),
    ADMIN_SEND_PASSWORD_RESET: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_SEND_PASSWORD_RESET),
    VERIFY_PASSWORD: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.VERIFY_PASSWORD),
    PROFILE: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.PROFILE),
    CHANGE_PASSWORD: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.CHANGE_PASSWORD),
    SECURITY: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SECURITY),
    EMAIL_CHANGE_REQUEST: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.EMAIL_CHANGE_REQUEST),
    EMAIL_CHANGE_CONFIRM: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.EMAIL_CHANGE_CONFIRM),
    TWO_FACTOR_STATUS: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_STATUS),
    TWO_FACTOR_SETUP: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_SETUP),
    TWO_FACTOR_VERIFY: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_VERIFY),
    TWO_FACTOR_RECOVERY_REGENERATE: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_RECOVERY),
    TWO_FACTOR_DISABLE: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_DISABLE),
    SSO_PROVIDERS: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SSO_PROVIDERS),
    SSO_LOGIN: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SSO_LOGIN),
    SESSIONS: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SESSIONS),
    MY_SESSIONS: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SESSIONS_ME),
    REVOKE_SESSION: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SESSIONS_ID_REVOKE),
    REVOKE_OTHER_SESSIONS: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SESSIONS_REVOKE_OTHERS),
    KILL_SESSION: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SESSIONS_ID_KILL),
    API_TOKENS: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.API_TOKENS),
    API_TOKEN: SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.API_TOKENS_ID),
    ACCOUNT_SELF_SERVICE: [
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SECURITY),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.PROFILE),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.CHANGE_PASSWORD),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.EMAIL_CHANGE_REQUEST),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SESSIONS_ME),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.SESSIONS_REVOKE_OTHERS),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_STATUS),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_SETUP),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_VERIFY),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_RECOVERY),
      SystemConstants.joinPath(SystemConstants.AUTH_BASE, SystemConstants.ROUTE_SEGMENTS.TWO_FACTOR_DISABLE),
    ] as const
  },
  SYSTEM: {
    BASE: SystemConstants.SYSTEM_BASE,
    HEALTH: SystemConstants.ROUTE_SEGMENTS.HEALTH,
    STATUS: SystemConstants.ROUTE_SEGMENTS.STATUS,
    FRONTEND: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.FRONTEND),
    ADMIN_BACKUPS: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS),
    ADMIN_BACKUP: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID),
    ADMIN_BACKUP_CREATE_SYSTEM: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_CREATE_SYSTEM),
    ADMIN_BACKUP_IMPORT: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT),
    ADMIN_BACKUP_IMPORT_SESSION: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT_SESSION),
    ADMIN_BACKUP_IMPORT_CHUNK: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT_CHUNK),
    ADMIN_BACKUP_IMPORT_COMPLETE: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_IMPORT_COMPLETE),
    ADMIN_BACKUP_DOWNLOAD: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID_DOWNLOAD),
    ADMIN_BACKUP_RESTORE_PREVIEW: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_PREVIEW),
    ADMIN_BACKUP_RESTORE_EXECUTE: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_EXECUTE),
    ADMIN_USERS: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_USERS),
    ADMIN_USER: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_USERS_ID),
    ADMIN_PEOPLE: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_PEOPLE),
    ADMIN_PEOPLE_ID: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_PEOPLE_ID),
    ADMIN_PEOPLE_CREATE_USER: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_PEOPLE_ID_CREATE_USER),
    ADMIN_PEOPLE_ID_RECORDS: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_PEOPLE_ID_RECORDS),
    ADMIN_PEOPLE_RECORDS: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_PEOPLE_RECORDS),
    RESOLVE: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.RESOLVE),
    I18N: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.I18N),
    EVENTS: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.EVENTS),
    SHORTCODES: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.SHORTCODES),
    SHORTCODES_RENDER: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.SHORTCODES_RENDER),
    ADMIN_PLUGINS: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_METADATA),
    ADMIN_STATS: SystemConstants.joinPath(SystemConstants.SYSTEM_BASE, SystemConstants.ROUTE_SEGMENTS.ADMIN_STATS_COLLECTIONS),
    OPENAPI: '/openapi.json',
    DOCS: '/docs'
  },
  COLLECTIONS: {
    SETTINGS: `${SystemConstants.COLLECTIONS_BASE}/settings`,
    BASE: SystemConstants.COLLECTIONS_BASE,
    ITEM: SystemConstants.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG,
    DETAIL: SystemConstants.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_ID,
    // `:slug`-templated action routes (fill via ApiPathUtils.fillPath) so callers never hardcode the
    // `/import`, `/export`, `/bulk-*` suffixes.
    EXPORT: SystemConstants.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_EXPORT,
    IMPORT: SystemConstants.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_IMPORT,
    BULK_UPDATE: SystemConstants.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_BULK_UPDATE,
    BULK_DELETE: SystemConstants.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_BULK_DELETE,
    SUGGESTIONS: SystemConstants.ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_SUGGESTIONS_FIELD
  },
  PLUGINS: {
    BASE: SystemConstants.PLUGINS_BASE,
    ACTIVE: SystemConstants.joinPath(SystemConstants.PLUGINS_BASE, SystemConstants.ROUTE_SEGMENTS.ACTIVE),
    UI: SystemConstants.joinPath(SystemConstants.PLUGINS_BASE, SystemConstants.ROUTE_SEGMENTS.PLUGINS_SLUG_UI_WILDCARD),
    TOGGLE: SystemConstants.joinPath(SystemConstants.PLUGINS_BASE, SystemConstants.ROUTE_SEGMENTS.PLUGINS_SLUG_TOGGLE),
    CONFIG: SystemConstants.joinPath(SystemConstants.PLUGINS_BASE, SystemConstants.ROUTE_SEGMENTS.PLUGINS_SLUG_CONFIG),
    DELETE: SystemConstants.joinPath(SystemConstants.PLUGINS_BASE, SystemConstants.ROUTE_SEGMENTS.PLUGINS_SLUG),
    MARKETPLACE: SystemConstants.joinPath(SystemConstants.ROUTE_SEGMENTS.MARKETPLACE, SystemConstants.PLUGINS_BASE),
    INSTALL: SystemConstants.joinPath(SystemConstants.PLUGINS_BASE, SystemConstants.ROUTE_SEGMENTS.PLUGINS_INSTALL)
  },
  THEMES: {
    BASE: SystemConstants.THEMES_BASE,
    PUBLIC: SystemConstants.joinPath(SystemConstants.THEMES_BASE, SystemConstants.ROUTE_SEGMENTS.THEMES_SLUG_PUBLIC_WILDCARD),
    UI: SystemConstants.joinPath(SystemConstants.THEMES_BASE, SystemConstants.ROUTE_SEGMENTS.THEMES_SLUG_UI_WILDCARD),
    MARKETPLACE: SystemConstants.joinPath(SystemConstants.THEMES_BASE, SystemConstants.ROUTE_SEGMENTS.PLUGINS_MARKETPLACE),
    DISABLE: SystemConstants.joinPath(SystemConstants.THEMES_BASE, SystemConstants.ROUTE_SEGMENTS.THEMES_SLUG_DISABLE)
  },
  MEDIA: {
    BASE: SystemConstants.MEDIA_BASE,
    UPLOAD: SystemConstants.joinPath(SystemConstants.MEDIA_BASE, SystemConstants.ROUTE_SEGMENTS.MEDIA_UPLOAD)
  },
  VERSIONS: {
    BASE: SystemConstants.VERSIONS_BASE,
    ITEM: SystemConstants.joinPath(SystemConstants.VERSIONS_BASE, SystemConstants.ROUTE_SEGMENTS.COLLECTIONS_SLUG_ID),
    RESTORE: SystemConstants.joinPath(SystemConstants.VERSIONS_BASE, SystemConstants.ROUTE_SEGMENTS.COLLECTIONS_SLUG_ID_VERSION_RESTORE)
  }
  } as const;

  /**
   * Frontend app routes (non-API page paths).
   */
  static readonly APP_PATH = {
  AUTH: AppPathConstants.AUTH,
  ADMIN: AppPathConstants.ADMIN
  } as const;

  /**
   * Storage / upload infrastructure configuration keys.
   */
  /**
   * On-disk layout INSIDE a theme package. The `ui` directory is also the `ui` segment of the served
   * route (`API_PATH.THEMES.UI`), which is why a served asset path maps onto disk one-for-one — see
   * `MediaPathUtils.resolveSafeThemeAssetDiskPath`. It was written out as a bare `'ui'` in four places.
   */
  static readonly THEME_DIR = {
    UI: 'ui',
  } as const;

  static readonly STORAGE = {
  UPLOAD_DIR_ENV: 'STORAGE_UPLOAD_DIR',
  PUBLIC_URL_ENV: 'STORAGE_PUBLIC_URL',
  DEFAULT_UPLOADS_SUBDIR: 'public/uploads',
  DEFAULT_PUBLIC_URL: '/uploads'
  } as const;

  /**
   * Route prefix strings used for internal permission checks.
   */
  static readonly PUBLIC_ROUTE_PREFIXES = {
  PLUGIN_ASSETS: `${SystemConstants.ROUTE_SEGMENTS.PLUGINS}/`,
  THEME_ASSETS: `${SystemConstants.ROUTE_SEGMENTS.THEMES}/`
  } as const;

}
