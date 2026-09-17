import { SettingScope } from '@core/settings/enums/setting-scope.enum';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import { SystemConstants } from '@core/constants/system.constants';
import type { ISystemSettingDescriptor } from '@core/settings/interfaces/system-setting-descriptor.interface';
import { SystemSettingSeedDefaults } from '@core/settings/system-setting-seed-defaults';

/**
 * What every system setting DECLARES: its scope, whether it is writable, whether it may be exposed,
 * and what to seed.
 *
 * Split out of `SystemSettingRegistry`, which was 447 lines — a 297-line declaration table and the
 * handful of methods that read it. The table is the half that grows, because every new setting adds
 * a row to it; the registry keeps the behaviour that answers questions about it.
 *
 * Keyed by the META_KEY values rather than `string`, so a key added without a descriptor here is a
 * COMPILE error rather than a setting that silently resolves to nothing.
 */
export class SystemSettingDescriptors {
  static readonly ALL: Record<typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY], ISystemSettingDescriptor> = {
    [SystemConstants.META_KEY.EMAIL_PROFILES]: { scope: SettingScope.SITE, writable: false, exposed: false },
    [SystemConstants.META_KEY.EMAIL_PROVIDER]: { scope: SettingScope.SITE, writable: false, exposed: false },
    [SystemConstants.META_KEY.EMAIL_PLATFORM_FALLBACK]: { scope: SettingScope.SITE, writable: false, exposed: true },

    [SystemConstants.META_KEY.MAINTENANCE_MODE]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: 'false', description: "Enable global maintenance mode.", group: "Settings" },
    },
    [SystemConstants.META_KEY.MCP_REMOTE_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'false', description: "Allow remote MCP clients (Claude web/desktop) to connect over Streamable HTTP with an API token. Off by default.", group: "Integrations" },
    }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '25', description: "Maximum media payload accepted by MCP upload and replace tools, in megabytes.", group: "Integrations" },
    }, // candidate for PLATFORM (Phase 2)
    // Not seeded, either of them: an unset dataset falls through to the next layer and the admin says
    // which, so there is nothing for a seeded row to claim. DEFAULTS is read by every site, so it is
    // PLATFORM; STRATEGIES is one site answering for the data it controls, so it is SITE.
    [SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_DEFAULTS]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES]: { scope: SettingScope.SITE, writable: true, exposed: true },

    [SystemConstants.META_KEY.SETUP_COMPLETED]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
    [SystemConstants.META_KEY.SITE_NAME]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'Fromcode', description: "Public site name used in emails and frontend.", group: "General" },
    },
    [SystemConstants.META_KEY.SITE_URL]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: () => SystemSettingSeedDefaults.urlDefaults().siteUrl, description: "Used only when Frontend URL is blank, as the same frontend address. Leave blank on a multi-site platform.", group: "General" },
    },
    [SystemConstants.META_KEY.FRONTEND_URL]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: () => SystemSettingSeedDefaults.urlDefaults().frontendUrl, description: "This deployment's frontend address. On a multi-site platform leave blank — a value here replaces every site's own domain in emails, sitemaps and links.", group: "General" },
    },
    [SystemConstants.META_KEY.ADMIN_URL]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: () => SystemSettingSeedDefaults.urlDefaults().adminUrl, description: "This deployment's admin console address — one console serves every site.", group: "General" },
    },
    [SystemConstants.META_KEY.API_URL]: {
      scope: SettingScope.PLATFORM, writable: true, exposed: true,
      seed: { value: () => SystemSettingSeedDefaults.urlDefaults().apiUrl, description: "The public base URL of the API. Blank uses the domain the admin and sites are served from.", group: "General" },
    },
    // ONE key for the platform and for every site — INHERITED, so a site may set its own and a site
    // that has not inherits the operator's. See SettingScope.INHERITED for why this needs no second key. `_system_meta` is keyed `(key, tenant_id)`, so a
    // site's row sits alongside the platform's rather than colliding, and the table's policy already
    // lets a tenant read the platform's row for this key — a site that has chosen nothing inherits the
    // operator's catalogue with no second key to express it. PLATFORM here declares who this service
    // answers for: `PlatformSettingsService` reads the platform's row and nothing else.
    [SystemConstants.META_KEY.MARKETPLACE_URL]: { scope: SettingScope.INHERITED, writable: true, exposed: true },
    // What a site may store in its OWN uploaded themes. PLATFORM scope, because the limit protects
    // the shared disk from any one site — a site setting its own ceiling would be no ceiling.
    [SystemConstants.META_KEY.TENANT_THEME_MAX_BYTES]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.TENANT_THEME_MAX_COUNT]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.DOMAIN_ALIASES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '[]', description: "Additional trusted domains kept active during migrations.", group: "General" },
    },
    [SystemConstants.META_KEY.TIMEZONE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'UTC', description: "Default system timezone.", group: "General" },
    },
    [SystemConstants.META_KEY.ADMIN_APPEARANCE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.ADMIN_SHADOWS]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.PLATFORM_NAME]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'Atlantis', description: "The identity of your platform instance.", group: "General" },
    }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.PLATFORM_DOMAIN]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: () => SystemSettingSeedDefaults.urlDefaults().platformDomain, description: "Root domain for the entire platform setup.", group: "General" },
    }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.TELEMETRY_ENABLED]: { scope: SettingScope.SITE, writable: true, exposed: true }, // candidate for PLATFORM (Phase 2)

    // TLS certificates are platform infrastructure: one authority, one set of public addresses for the
    // whole deployment. A site cannot own these — it does not own the IP addresses its own domain has to
    // point at.
    [SystemConstants.META_KEY.CERTIFICATE_ACME_DIRECTORY]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.CERTIFICATE_ACME_CONTACT_EMAIL]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.CERTIFICATE_PLATFORM_ADDRESSES]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    // A CREDENTIAL, not a setting the generic PUT may touch — same shape as EMAIL_PROFILES above.
    // Written only through AcmeCloudflareTokenStore (encrypted via SecretService) and never read back
    // in the clear; AcmeSettings exposes only whether it is configured, not the value.
    [SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN]: { scope: SettingScope.PLATFORM, writable: false, exposed: false },

    // PLATFORM, and the "candidate (Phase 2)" note that stood here was the bug. `JournalRetentionService`
    // starts ONCE per api process and sweeps on ONE daily interval, reading the value on an untenanted
    // connection — which under the `_system_meta` policy sees the `tenant_id IS NULL` row and nothing
    // else. Declared SITE, the only control for it (Settings -> Infrastructure, a platform screen) could
    // not write a row the sweep would ever read: refused outright with no site selected, and filed under
    // a tenant with one. Dead in both scopes on every multi-site deployment.
    [SystemConstants.META_KEY.LOG_RETENTION_DAYS]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    // PLATFORM for the same reason as the logs window: one sweep, one process, one untenanted read.
    // No seed — an empty value is KEEP FOREVER, and a platform that started expiring its own security
    // record because a registry picked a number would be the invented default this codebase forbids.
    [SystemConstants.META_KEY.AUDIT_RETENTION_DAYS]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },

    // Localization
    [SystemConstants.META_KEY.LOCALIZATION_LOCALES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '[{"code":"en","name":"English","enabled":true}]', description: "Available locales.", group: "Localization" },
    },
    [SystemConstants.META_KEY.ENABLED_LOCALES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Enabled locale codes.", group: "Localization" },
    },
    [SystemConstants.META_KEY.DEFAULT_LOCALE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Default locale.", group: "Localization" },
    },
    [SystemConstants.META_KEY.FALLBACK_LOCALE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Default admin language.", group: "Localization" },
    },
    [SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'en', description: "Default frontend language.", group: "Localization" },
    },
    [SystemConstants.META_KEY.LOCALE_URL_STRATEGY]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'query', description: "Locale URL strategy.", group: "Localization" },
    },
    [SystemConstants.META_KEY.MEASUREMENT_SYSTEM]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'metric', description: "Units for physical dimensions and weight (metric cm/kg | imperial in/lb).", group: "Localization" },
    },

    // Security & Auth
    [SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Send security notification emails.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_SESSION_DURATION]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '10080', description: "Login session duration in minutes.", group: "security" },
    },
    [SystemConstants.META_KEY.SSR_GENERATION_CAP]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.PLUGIN_ISOLATION_DEFAULT]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.SSR_RENDER_MEMORY_MB]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.QUEUE_JOB_ATTEMPTS]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.QUEUE_JOB_BACKOFF_MS]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.QUEUE_KEEP_COMPLETED]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.QUEUE_KEEP_FAILED]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.QUEUE_CONCURRENCY]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemConstants.META_KEY.SSR_RENDER_TIMEOUT_MS]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '8', description: "Minimum required password length.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Require uppercase letters.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Require lowercase letters.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Require digits.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'false', description: "Require symbols.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '5', description: "Prevent reuse of the last N passwords.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'false', description: "Ask a breach-check provider whether a new password appears in known breaches. Calls the \"auth:password:breach-check\" hook. With no plugin answering it, nothing is rejected.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '30', description: "Password reset token lifetime in minutes.", group: "security" },
    },

    // Private file delivery
    [SystemConstants.META_KEY.FILE_SHARE_DEFAULT_EXPIRY_DAYS]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '30', description: "Default lifetime of a shared-file link, in days. 0 = never expires.", group: "Files" },
    },
    [SystemConstants.META_KEY.FILE_SHARE_DEFAULT_MAX_DOWNLOADS]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '0', description: "Default number of downloads allowed per recipient. 0 = unlimited.", group: "Files" },
    },
    [SystemConstants.META_KEY.FILE_SHARE_RATE_LIMIT_PER_MINUTE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '30', description: "Maximum shared-file link requests per minute, per address.", group: "Files" },
    },
    [SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '60', description: "Email change token lifetime in minutes.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '5', description: "Failed logins before lockout.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '15', description: "Window for counting failed logins.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '30', description: "Lockout duration in minutes.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'false', description: "Require captcha after repeated failures.", group: "security" },
    },
    [SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '3', description: "Failed attempts before captcha is required.", group: "security" },
    },
    [SystemConstants.META_KEY.TWO_FACTOR_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'false', description: "Enable two-factor authentication.", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_MAX]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '100', description: "Maximum requests per window per IP.", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '5000', description: "Maximum requests per window for signed-in requests (counted per IP + token).", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '20000', description: "Maximum requests per window for internal server-to-server calls (the storefront renderer), counted per calling service address.", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: NetworkAddressUtils.PRIVATE_RANGES_TEXT, description: "Addresses/CIDR blocks that count as internal service callers (the storefront renderer, workers). Clear it and nothing is internal: every anonymous caller falls back to the public limit.", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_EDGE_PROVIDER_RANGES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: () => SystemSettingSeedDefaults.edgeProviderRangesDefault(), description: "Each registered edge provider's published IP ranges, trusted to set that provider's real-visitor header (e.g. Cloudflare's CF-Connecting-IP). JSON, keyed by the provider's own key (\"cloudflare\", ...). Seeded with the ranges built into the code; extend a provider's entry if it publishes a new range before the platform is updated. Never remove a range here to reduce trust — that requires a code change.", group: "security" },
    },
    [SystemConstants.META_KEY.RATE_LIMIT_WINDOW]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '900000', description: "Rate limit window in milliseconds.", group: "security" },
    },
    [SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'fcp_analytics_events, fcp_analytics_sessions', description: "Physical table names (comma separated) whose plugin database writes are NOT recorded in the audit log. Seeded with the high-volume analytics tables so telemetry does not drown the trail; clear it and every plugin write is audited.", group: "security" },
    },

    // Routing & Features
    [SystemConstants.META_KEY.PERMALINK_STRUCTURE]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: '/:slug', description: "Default URL structure for content.", group: "General" },
    },
    [SystemConstants.META_KEY.ROUTING_HOME_TARGET]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'auto', description: "Homepage route target.", group: "Routing" },
    },
    [SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Enable frontend auth flows.", group: "security" },
    },
    [SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Allow new customer self-registration.", group: "security" },
    },
    [SystemConstants.META_KEY.EMAIL_NOTIFICATIONS]: {
      scope: SettingScope.SITE, writable: true, exposed: true,
      seed: { value: 'true', description: "Receive system alerts via email.", group: "Engagement" },
    },
    [SystemConstants.META_KEY.NOTIFICATION_EMAIL]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.NOTIFICATION_EMAIL_CC]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.FRAMEWORK_REPOSITORY]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemConstants.META_KEY.SOURCES_WORKSPACE_ROOT]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
  };


}
