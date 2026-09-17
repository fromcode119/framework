/**
 * Well-known keys in the system meta table.
 *
 * Split out of `SystemConstants` for size. Reached as `SystemConstants.META_KEY.*` exactly as before.
 *
 * `as const` is load-bearing: `SystemSettingRegistry` is typed
 * `Record<typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY], …>`, so a key added
 * here without a descriptor is a compile error. Widen these to `string` and that check disappears.
 */
export class SystemMetaKeys {
  static readonly ALL = {
  EMAIL_PROFILES: 'integration_email_profiles',
  EMAIL_PROVIDER: 'integration_email_provider',
  /**
   * May THIS SITE send through the PLATFORM's mail server when it has configured none of its own?
   * Tenant-scoped like every other row in `_system_meta`, and OFF unless the operator turns it on.
   *
   * Off is the safe default because the alternative is silent: a site with no mail configuration
   * quietly borrowed the platform's SMTP credentials, so one customer's mail left on another's server,
   * under the platform's SPF and DKIM and against the platform's sending reputation — with nothing in
   * any interface saying so. A site that genuinely should use platform mail says so here, once.
   */
  EMAIL_PLATFORM_FALLBACK: 'email_platform_fallback',

  MAINTENANCE_MODE: 'maintenance_mode',
  /** Hosted MCP transport (Streamable HTTP at POST /mcp). Off unless the operator enables it — Settings → Integrations → MCP. */
  MCP_REMOTE_ENABLED: 'mcp_remote_enabled',
  /** Maximum media payload accepted by MCP upload/replace tools, edited beside the hosted MCP toggle. */
  MCP_REMOTE_MEDIA_MAX_MB: 'mcp_remote_media_max_mb',
  /**
   * How each dataset honours an erasure request, keyed `"<pluginSlug>:<dataset>"`.
   *
   * Two keys, one shape, because the answer has two audiences: DEFAULTS is the platform's policy
   * across every site, STRATEGIES is one site's override of it. Neither is seeded — an unset dataset
   * falls through to the next layer and the admin names which, so a fallback is never mistaken for a
   * decision somebody made.
   *
   * Framework-owned rather than a compliance plugin's setting, because the reader that must obey it
   * is `deleteMyAccount`, which runs on every site whether or not such a plugin is installed.
   */
  PERSONAL_DATA_ERASURE_DEFAULTS: 'personal_data_erasure_defaults',
  PERSONAL_DATA_ERASURE_STRATEGIES: 'personal_data_erasure_strategies',

  SETUP_COMPLETED: 'setup_completed',
  SITE_NAME: 'site_name',
  SITE_URL: 'site_url',
  FRONTEND_URL: 'frontend_url',
  ADMIN_URL: 'admin_url',
  /**
   * The api's own public base URL.
   *
   * Declared late, and that is the point: admin/frontend/site were settings the resolver preferred
   * over the environment, while this one was env-only — so renaming the api host meant editing a
   * deployment's `.env` and redeploying, while its two siblings were a field in the admin.
   */
  API_URL: 'api_url',
  MARKETPLACE_URL: 'marketplace_url',
  DOMAIN_ALIASES: 'domain_aliases',
  TIMEZONE: 'timezone',
  ADMIN_APPEARANCE: 'admin_appearance',
  /** Whether admin surfaces render elevated (shadows) or flat. Absent = elevated. */
  ADMIN_SHADOWS: 'admin_shadows',
  /**
   * How much a SITE may store in themes it uploaded itself, and how many it may keep.
   *
   * Declared rather than hardcoded because the themes volume is ONE host directory shared by every
   * tenant on the machine: the right number depends on that machine's disk, which only the operator
   * knows. Both are visible and changeable in admin Settings, and the defaults live in the schema
   * where an operator can see what they are — never as a literal in the install path.
   */
  TENANT_THEME_MAX_BYTES: 'tenant_theme_max_bytes',
  TENANT_THEME_MAX_COUNT: 'tenant_theme_max_count',
  PLATFORM_NAME: 'platform_name',
  PLATFORM_DOMAIN: 'platform_domain',
  TELEMETRY_ENABLED: 'telemetry_enabled',
  /**
   * Which certificate authority the platform orders from.
   *
   * BLANK MEANS AUTOMATIC ISSUANCE IS OFF, and the admin says so. There is deliberately no default:
   * a deployment that has not chosen an authority must not quietly start ordering certificates from
   * one, and the staging directory has to be a deliberate choice so it can be used for testing.
   */
  CERTIFICATE_ACME_DIRECTORY: 'certificate_acme_directory',
  /** The address the certificate authority contacts about the account. Optional. */
  CERTIFICATE_ACME_CONTACT_EMAIL: 'certificate_acme_contact_email',
  /**
   * The public addresses customers point their DNS at, entered by the operator.
   *
   * Blank means automatic issuance is off. This is never inferred from the running host: the value
   * is what the admin PRINTS as DNS instructions and what a domain is checked against before a
   * certificate is ordered, so a guess here would send customers to the wrong address and burn the
   * certificate authority's failure budget proving it.
   */
  CERTIFICATE_PLATFORM_ADDRESSES: 'certificate_platform_addresses',
  /**
   * The Cloudflare API token used for DNS-01 challenges (wildcard certificates).
   *
   * STORED ENCRYPTED, via SecretService, exactly like an integration's own credentials — this is a
   * token with DNS edit rights on the operator's zone. BLANK MEANS DNS-01 IS UNAVAILABLE, the same
   * shape as the rest of this feature: an admin who has not pasted a token has not consented to the
   * platform managing DNS records, so nothing here is guessed or reused from anywhere else. Never
   * exposed through the generic settings read — see AcmeSettings.isCloudflareConfigured — and never
   * returned to any admin response; only whether it is set.
   */
  CERTIFICATE_ACME_CLOUDFLARE_TOKEN: 'certificate_acme_cloudflare_token',
  /**
   * Days of `_system_logs` history to keep. Empty or 0 means KEEP FOREVER, and the admin field
   * says so — nothing prunes behind the operator's back. Read by JournalRetentionService.
   */
  LOG_RETENTION_DAYS: 'log_retention_days',
  /**
   * Days of `_system_audit_logs` history to keep. Empty means KEEP FOREVER.
   *
   * SEPARATE FROM `LOG_RETENTION_DAYS`, and floored, because this table is not debug output. It is
   * the security and operator record — denied actions, `settings.update`, `collection.delete`, MCP
   * `tool.call` — and `packages/ai/src/extension.ts` declares it the platform's **EU AI Act Art. 12**
   * record-keeping store for `ai.invoke`. A window shorter than the six months that record is
   * expected to survive would let the platform quietly break a commitment its own code makes, so a
   * value below {@link AUDIT_RETENTION_MIN_DAYS} is REFUSED with the reason rather than clamped.
   */
  AUDIT_RETENTION_DAYS: 'audit_retention_days',
  
  // Localization
  LOCALIZATION_LOCALES: 'localization_locales',
  ENABLED_LOCALES: 'enabled_locales',
  DEFAULT_LOCALE: 'default_locale',
  FALLBACK_LOCALE: 'fallback_locale',
  ADMIN_DEFAULT_LOCALE: 'admin_default_locale',
  FRONTEND_DEFAULT_LOCALE: 'frontend_default_locale',
  LOCALE_URL_STRATEGY: 'locale_url_strategy',
  // Platform-wide measurement system (metric cm/kg | imperial in/lb). A regional format like locale —
  // domain plugins read it for their own units; the framework stays domain-agnostic.
  MEASUREMENT_SYSTEM: 'measurement_system',
  
  // Security & Auth
  AUTH_SECURITY_NOTIFICATIONS: 'auth_security_notifications',
  AUTH_SESSION_DURATION: 'auth_session_duration_minutes',
  /** How many distinct server-render worlds (theme+plugin version sets) the storefront keeps resident. Settings → Infrastructure. */
  SSR_GENERATION_CAP: 'ssr_generation_cap',
  /** `isolated` (own process per plugin, the default) or `shared` (in the api process). */
  PLUGIN_ISOLATION_DEFAULT: 'plugin_isolation_default',
  PLUGIN_ISOLATION_MEMORY_MB: 'plugin_isolation_memory_mb',
  PLUGIN_ISOLATION_TIMEOUT_MS: 'plugin_isolation_timeout_ms',
  /** Heap ceiling (MB) and per-render deadline (ms) of one theme render host process. */
  SSR_RENDER_MEMORY_MB: 'ssr_render_memory_mb',
  QUEUE_JOB_ATTEMPTS: 'queue_job_attempts',
  QUEUE_JOB_BACKOFF_MS: 'queue_job_backoff_ms',
  QUEUE_KEEP_COMPLETED: 'queue_keep_completed',
  QUEUE_KEEP_FAILED: 'queue_keep_failed',
  QUEUE_CONCURRENCY: 'queue_concurrency',
  SSR_RENDER_TIMEOUT_MS: 'ssr_render_timeout_ms',
  AUTH_PASSWORD_MIN_LENGTH: 'auth_password_min_length',
  AUTH_PASSWORD_REQUIRE_UPPERCASE: 'auth_password_require_uppercase',
  AUTH_PASSWORD_REQUIRE_LOWERCASE: 'auth_password_require_lowercase',
  AUTH_PASSWORD_REQUIRE_NUMBER: 'auth_password_require_number',
  AUTH_PASSWORD_REQUIRE_SYMBOL: 'auth_password_require_symbol',
  AUTH_PASSWORD_HISTORY: 'auth_password_history',
  AUTH_PASSWORD_BREACH_CHECK: 'auth_password_breach_check',
  AUTH_PASSWORD_RESET_TOKEN_MINUTES: 'auth_password_reset_token_minutes',

  // Private file delivery. Defaults for a new share; every one is overridable per send, and `0` means
  // unlimited/never throughout — the one convention, chosen because the two features this generalises
  // disagreed (one plugin used 0 for "never expires", another read 0 AND -1 as "unlimited").
  FILE_SHARE_DEFAULT_EXPIRY_DAYS: 'file_share_default_expiry_days',
  FILE_SHARE_DEFAULT_MAX_DOWNLOADS: 'file_share_default_max_downloads',
  FILE_SHARE_RATE_LIMIT_PER_MINUTE: 'file_share_rate_limit_per_minute',
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
  /**
   * Additional edge-provider IP ranges/CIDR blocks an operator has declared, on top of each
   * registered provider's own hardcoded default ranges. A hop landing on one of these ranges is
   * trusted to set that provider's `trustedIpHeader` — see {@link NetworkAddressUtils.resolveClientIp}.
   *
   * ONE generic key for every provider registered in `NetworkEdgeProviderRegistry`, not a key per
   * vendor: the stored value is JSON keyed by each provider's own `key` (e.g. `{"cloudflare":"..."}`).
   * Seeded from the hardcoded ranges every registered provider already ships with, so the setting
   * starts equal to what the code already trusts; an operator extends a provider's entry, without a
   * deploy, the day that provider publishes a range this platform's code does not know about yet. A
   * second provider needs no new key here — only a new entry in the same JSON object.
   */
  RATE_LIMIT_EDGE_PROVIDER_RANGES: 'rate_limit_edge_provider_ranges',
  RATE_LIMIT_WINDOW: 'rate_limit_window',
  /**
   * Physical table names whose plugin `context.db` writes are NOT recorded in the audit log
   * (comma-separated). Read by {@link DatabaseWriteAudit} on every plugin write; seeded with the
   * high-volume analytics tables so telemetry does not drown the trail. Admin Settings → Security.
   */
  AUDIT_DB_WRITE_EXCLUDED_TABLES: 'audit_db_write_excluded_tables',
  
  // Routing & Features
  PERMALINK_STRUCTURE: 'permalink_structure',
  ROUTING_HOME_TARGET: 'routing_home_target',
  FRONTEND_AUTH_ENABLED: 'frontend_auth_enabled',
  FRONTEND_REGISTRATION_ENABLED: 'frontend_registration_enabled',
  EMAIL_NOTIFICATIONS: 'email_notifications',
  NOTIFICATION_EMAIL: 'notification_email',
  NOTIFICATION_EMAIL_CC: 'notification_email_cc',
  /**
   * Whether search engines may index the PLATFORM'S OWN HOSTS — the admin console and the api
   * host, both of which read this one switch. Off unless an operator turns it on. A tenant's
   * site is NOT governed by it; a site follows its own visibility.
   *
   * The stored key still says `admin_` because renaming a `_system_meta` key is a migration and
   * an allowlist change for no behaviour; the operator-facing label is where the scope is stated.
   */
  ADMIN_SEARCH_INDEXING: 'admin_search_indexing',
  /**
   * `owner/repo` checked for framework releases, and where Sources writes what it builds.
   *
   * Declared here because the General settings page WRITES them. They once existed ONLY on the read
   * side, in a duplicate key map, so the admin sent keys the write side had never heard of and the
   * whole PUT 400'd — which is also why the workspace root could be typed in and never took effect.
   * That duplicate is gone: this list is the single identity, and `SystemSettingRegistry` declares
   * each key's scope against it.
   */
  FRAMEWORK_REPOSITORY: 'framework_repository',
  SOURCES_WORKSPACE_ROOT: 'sources_workspace_root'
  } as const;
}
