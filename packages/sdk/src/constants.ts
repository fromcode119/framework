/**
 * System-reserved database tables.
 * Plugins should use these names instead of hardcoded strings.
 */
export const SystemTable = {
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
export const SystemMetaKey = {
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

export const ApiPath = {
  AUTH: {
    STATUS: '/auth/status',
    SETUP: '/auth/setup',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    VERIFY_EMAIL: '/auth/verify-email',
    RESEND_VERIFICATION: '/auth/resend-verification',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_PASSWORD: '/auth/verify-password',
    CHANGE_PASSWORD: '/auth/change-password',
    SECURITY: '/auth/security',
    EMAIL_CHANGE_REQUEST: '/auth/email-change/request',
    EMAIL_CHANGE_CONFIRM: '/auth/email-change/confirm',
    SSO_PROVIDERS: '/auth/sso/providers',
    SSO_LOGIN: '/auth/sso/login',
    SESSIONS: '/auth/sessions',
    MY_SESSIONS: '/auth/sessions/me',
    REVOKE_SESSION: '/auth/sessions/:id/revoke',
    REVOKE_OTHER_SESSIONS: '/auth/sessions/revoke-others',
    KILL_SESSION: '/auth/sessions/:id/kill',
    API_TOKENS: '/auth/api-tokens',
    API_TOKEN: '/auth/api-tokens/:id'
  },
  SYSTEM: {
    HEALTH: '/health',
    RESOLVE: '/system/resolve',
    I18N: '/system/i18n',
    EVENTS: '/system/events',
    SHORTCODES: '/system/shortcodes',
    SHORTCODES_RENDER: '/system/shortcodes/render',
    ADMIN_PLUGINS: '/system/admin/metadata',
    ADMIN_STATS: '/system/admin/stats/collections',
    OPENAPI: '/openapi.json'
  },
  COLLECTIONS: {
    SETTINGS: '/collections/settings',
    BASE: '/collections',
    ITEM: '/collections/:slug',
    DETAIL: '/collections/:slug/:id'
  },
  PLUGINS: {
    BASE: '/plugins',
    ACTIVE: '/plugins/active',
    UI: '/plugins/:slug/ui/*',
    TOGGLE: '/plugins/:slug/toggle',
    CONFIG: '/plugins/:slug/config',
    DELETE: '/plugins/:slug',
    MARKETPLACE: '/marketplace/plugins',
    INSTALL: '/marketplace/install'
  },
  THEMES: {
    BASE: '/themes',
    MARKETPLACE: '/themes/marketplace'
  },
  MEDIA: {
    BASE: '/media',
    UPLOAD: '/media/upload'
  }
} as const;

/**
 * Frontend app routes (non-API page paths).
 */
export const AppPath = {
  AUTH: {
    LOGIN: '/login',
    SETUP: '/setup',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    VERIFY_EMAIL: '/verify-email',
    VERIFY_EMAIL_CHANGE: '/verify-email-change'
  }
} as const;

/**
 * Storage / upload infrastructure configuration keys.
 */
export const StorageConfig = {
  UPLOAD_DIR_ENV: 'STORAGE_UPLOAD_DIR',
  PUBLIC_URL_ENV: 'STORAGE_PUBLIC_URL',
  DEFAULT_UPLOADS_SUBDIR: 'public/uploads',
  DEFAULT_PUBLIC_URL: '/uploads'
} as const;

/**
 * Route prefix strings used for internal permission checks.
 */
export const PublicRoutePrefixes = {
  PLUGIN_ASSETS: '/plugins/'
} as const;
