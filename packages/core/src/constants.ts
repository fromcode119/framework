import { AppPathConstants } from './app-path-constants';
import { RouteConstants } from './route-constants';

const ROUTE_SEGMENTS = RouteConstants.SEGMENTS;
const AUTH_BASE = ROUTE_SEGMENTS.AUTH;
const SYSTEM_BASE = ROUTE_SEGMENTS.SYSTEM;
const PLUGINS_BASE = ROUTE_SEGMENTS.PLUGINS;
const THEMES_BASE = ROUTE_SEGMENTS.THEMES;
const MEDIA_BASE = ROUTE_SEGMENTS.MEDIA;
const VERSIONS_BASE = ROUTE_SEGMENTS.VERSIONS;
const COLLECTIONS_BASE = '/collections';
const joinPath = (base: string, segment: string): string => `${base}${segment}`;

/**
 * System-reserved database tables.
 * Plugins should use these names instead of hardcoded strings.
 */
export class SystemConstants {
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
    META: '_system_meta',
    MEDIA: 'media',
    MEDIA_FOLDERS: 'media_folders',
    RECORD_VERSIONS: '_system_record_versions',
    WEBHOOKS: '_system_webhooks',
    SCHEDULER_TASKS: '_system_scheduler_tasks',
    USERS_ROLES: '_system_users_roles',
    MIGRATIONS: '_system_migrations'
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
  TIMEZONE: 'timezone',
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
  RATE_LIMIT_WINDOW: 'rate_limit_window',
  
  // Routing & Features
  PERMALINK_STRUCTURE: 'permalink_structure',
  ROUTING_HOME_TARGET: 'routing_home_target',
  FRONTEND_AUTH_ENABLED: 'frontend_auth_enabled',
  FRONTEND_REGISTRATION_ENABLED: 'frontend_registration_enabled',
  EMAIL_NOTIFICATIONS: 'email_notifications'
  } as const;

  static readonly API_PATH = {
  AUTH: {
    BASE: AUTH_BASE,
    STATUS: joinPath(AUTH_BASE, ROUTE_SEGMENTS.STATUS),
    SETUP: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SETUP),
    LOGIN: joinPath(AUTH_BASE, ROUTE_SEGMENTS.LOGIN),
    LOGOUT: joinPath(AUTH_BASE, ROUTE_SEGMENTS.LOGOUT),
    REGISTER: joinPath(AUTH_BASE, ROUTE_SEGMENTS.REGISTER),
    VERIFY_EMAIL: joinPath(AUTH_BASE, ROUTE_SEGMENTS.VERIFY_EMAIL),
    RESEND_VERIFICATION: joinPath(AUTH_BASE, ROUTE_SEGMENTS.RESEND_VERIFICATION),
    FORGOT_PASSWORD: joinPath(AUTH_BASE, ROUTE_SEGMENTS.FORGOT_PASSWORD),
    RESET_PASSWORD: joinPath(AUTH_BASE, ROUTE_SEGMENTS.RESET_PASSWORD),
    VERIFY_PASSWORD: joinPath(AUTH_BASE, ROUTE_SEGMENTS.VERIFY_PASSWORD),
    PROFILE: joinPath(AUTH_BASE, ROUTE_SEGMENTS.PROFILE),
    CHANGE_PASSWORD: joinPath(AUTH_BASE, ROUTE_SEGMENTS.CHANGE_PASSWORD),
    SECURITY: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SECURITY),
    EMAIL_CHANGE_REQUEST: joinPath(AUTH_BASE, ROUTE_SEGMENTS.EMAIL_CHANGE_REQUEST),
    EMAIL_CHANGE_CONFIRM: joinPath(AUTH_BASE, ROUTE_SEGMENTS.EMAIL_CHANGE_CONFIRM),
    TWO_FACTOR_STATUS: joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_STATUS),
    TWO_FACTOR_SETUP: joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_SETUP),
    TWO_FACTOR_VERIFY: joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_VERIFY),
    TWO_FACTOR_RECOVERY_REGENERATE: joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_RECOVERY),
    TWO_FACTOR_DISABLE: joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_DISABLE),
    SSO_PROVIDERS: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SSO_PROVIDERS),
    SSO_LOGIN: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SSO_LOGIN),
    SESSIONS: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SESSIONS),
    MY_SESSIONS: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SESSIONS_ME),
    REVOKE_SESSION: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SESSIONS_ID_REVOKE),
    REVOKE_OTHER_SESSIONS: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SESSIONS_REVOKE_OTHERS),
    KILL_SESSION: joinPath(AUTH_BASE, ROUTE_SEGMENTS.SESSIONS_ID_KILL),
    API_TOKENS: joinPath(AUTH_BASE, ROUTE_SEGMENTS.API_TOKENS),
    API_TOKEN: joinPath(AUTH_BASE, ROUTE_SEGMENTS.API_TOKENS_ID),
    ACCOUNT_SELF_SERVICE: [
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.SECURITY),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.PROFILE),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.CHANGE_PASSWORD),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.EMAIL_CHANGE_REQUEST),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.SESSIONS_ME),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.SESSIONS_REVOKE_OTHERS),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_STATUS),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_SETUP),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_VERIFY),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_RECOVERY),
      joinPath(AUTH_BASE, ROUTE_SEGMENTS.TWO_FACTOR_DISABLE),
    ] as const
  },
  SYSTEM: {
    BASE: SYSTEM_BASE,
    HEALTH: ROUTE_SEGMENTS.HEALTH,
    STATUS: ROUTE_SEGMENTS.STATUS,
    FRONTEND: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.FRONTEND),
    ADMIN_USERS: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.ADMIN_USERS),
    ADMIN_USER: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.ADMIN_USERS_ID),
    RESOLVE: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.RESOLVE),
    I18N: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.I18N),
    EVENTS: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.EVENTS),
    SHORTCODES: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.SHORTCODES),
    SHORTCODES_RENDER: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.SHORTCODES_RENDER),
    ADMIN_PLUGINS: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.ADMIN_METADATA),
    ADMIN_STATS: joinPath(SYSTEM_BASE, ROUTE_SEGMENTS.ADMIN_STATS_COLLECTIONS),
    OPENAPI: '/openapi.json'
  },
  COLLECTIONS: {
    SETTINGS: `${COLLECTIONS_BASE}/settings`,
    BASE: COLLECTIONS_BASE,
    ITEM: ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG,
    DETAIL: ROUTE_SEGMENTS.GLOBAL_COLLECTIONS_SLUG_ID
  },
  PLUGINS: {
    BASE: PLUGINS_BASE,
    ACTIVE: joinPath(PLUGINS_BASE, ROUTE_SEGMENTS.ACTIVE),
    UI: joinPath(PLUGINS_BASE, ROUTE_SEGMENTS.PLUGINS_SLUG_UI_WILDCARD),
    TOGGLE: joinPath(PLUGINS_BASE, ROUTE_SEGMENTS.PLUGINS_SLUG_TOGGLE),
    CONFIG: joinPath(PLUGINS_BASE, ROUTE_SEGMENTS.PLUGINS_SLUG_CONFIG),
    DELETE: joinPath(PLUGINS_BASE, ROUTE_SEGMENTS.PLUGINS_SLUG),
    MARKETPLACE: joinPath(ROUTE_SEGMENTS.MARKETPLACE, PLUGINS_BASE),
    INSTALL: joinPath(ROUTE_SEGMENTS.MARKETPLACE, ROUTE_SEGMENTS.PLUGINS_INSTALL)
  },
  THEMES: {
    BASE: THEMES_BASE,
    MARKETPLACE: joinPath(THEMES_BASE, ROUTE_SEGMENTS.PLUGINS_MARKETPLACE)
  },
  MEDIA: {
    BASE: MEDIA_BASE,
    UPLOAD: joinPath(MEDIA_BASE, ROUTE_SEGMENTS.MEDIA_UPLOAD)
  },
  VERSIONS: {
    BASE: VERSIONS_BASE,
    ITEM: joinPath(VERSIONS_BASE, ROUTE_SEGMENTS.COLLECTIONS_SLUG_ID),
    RESTORE: joinPath(VERSIONS_BASE, ROUTE_SEGMENTS.COLLECTIONS_SLUG_ID_VERSION_RESTORE)
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
  PLUGIN_ASSETS: `${ROUTE_SEGMENTS.PLUGINS}/`
  } as const;

}
