import { SystemConstants } from '@core/constants/system.constants';
import { SettingScope } from '@core/settings/enums/setting-scope.enum';

/** Every declared `_system_meta` key, derived from `META_KEY` so a new key with no descriptor here is a compile error. */
export type SystemSettingKey = typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY];

export interface SystemSettingDescriptor {
  /**
   * Who this setting's value is FOR — see {@link SettingScope}. Decided by WHO READS it: boot,
   * background/cron work, and platform infrastructure (URLs, certificates, isolation, SSR, maintenance,
   * setup, marketplace, repository, workspace root, indexing) are PLATFORM; everything else is SITE.
   * No default — every key must say which, on purpose.
   */
  scope: SettingScope;
  /** May the generic settings PUT accept this key at all? False for credential blobs and internal bookkeeping. */
  writable: boolean;
  /**
   * May this row leave the server in an admin/settings response?
   *
   * `_system_meta` is the framework's key/value scratch space, not a settings table: alongside the
   * operator-visible settings it holds live SMTP and gateway passwords. Exposure used to be decided
   * by a `startsWith('integration_')` test — a PREFIX standing in for a property, which is the same
   * shape of mistake as scope-by-omission: a credential stored under any other prefix would have
   * been served to the admin client automatically. Declared here instead, per key.
   */
  exposed: boolean;
}

/**
 * The single place a system setting's SCOPE is declared.
 *
 * Before this registry, scope was decided by whether a key happened to appear in a hand-written array
 * (`TenantBespokePolicies.PLATFORM_KEYS`) — so a key was per-site by omission, silently, and every
 * reader involved fails closed, which is exactly how `admin_search_indexing`, `framework_repository`
 * and `sources_workspace_root` shipped broken: the write landed under whichever tenant the request
 * carried, the platform-only reader never found it, and nothing on the page or in a log said so.
 *
 * `Record<SystemSettingKey, SystemSettingDescriptor>` makes that specific bug a compile error: every
 * value `META_KEY` declares must have an entry here, or the file does not build.
 *
 * MUST NOT import `TenantMode` or `PlatformSettingsService` — scope belongs to the setting, mode
 * belongs to the deployment, and only `SystemSettingsController.updateSettings` branches on mode.
 */
export class SystemSettingRegistry {
  private static readonly KEY = SystemConstants.META_KEY;

  private static readonly REGISTRY: Record<SystemSettingKey, SystemSettingDescriptor> = {
    [SystemSettingRegistry.KEY.EMAIL_PROFILES]: { scope: SettingScope.SITE, writable: false, exposed: false },
    [SystemSettingRegistry.KEY.EMAIL_PROVIDER]: { scope: SettingScope.SITE, writable: false, exposed: false },
    [SystemSettingRegistry.KEY.EMAIL_PLATFORM_FALLBACK]: { scope: SettingScope.SITE, writable: false, exposed: true },

    [SystemSettingRegistry.KEY.MAINTENANCE_MODE]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.MCP_REMOTE_ENABLED]: { scope: SettingScope.SITE, writable: true, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.MCP_REMOTE_MEDIA_MAX_MB]: { scope: SettingScope.SITE, writable: true, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.SETUP_COMPLETED]: { scope: SettingScope.PLATFORM, writable: false, exposed: true },
    [SystemSettingRegistry.KEY.SITE_NAME]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.SITE_URL]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FRONTEND_URL]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.ADMIN_URL]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.MARKETPLACE_URL]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.DOMAIN_ALIASES]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.TIMEZONE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.ADMIN_APPEARANCE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.ADMIN_SHADOWS]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.PLATFORM_NAME]: { scope: SettingScope.SITE, writable: true, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.PLATFORM_DOMAIN]: { scope: SettingScope.SITE, writable: true, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.TELEMETRY_ENABLED]: { scope: SettingScope.SITE, writable: true, exposed: true }, // candidate for PLATFORM (Phase 2)

    // TLS certificates are platform infrastructure: one authority, one set of public addresses for the
    // whole deployment. A site cannot own these — it does not own the addresses its own domain has to
    // point at.
    [SystemSettingRegistry.KEY.CERTIFICATE_ACME_DIRECTORY]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.CERTIFICATE_ACME_CONTACT_EMAIL]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.CERTIFICATE_PLATFORM_ADDRESSES]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },

    [SystemSettingRegistry.KEY.LOG_RETENTION_DAYS]: { scope: SettingScope.SITE, writable: true, exposed: true }, // candidate for PLATFORM (Phase 2)

    // Localization
    [SystemSettingRegistry.KEY.LOCALIZATION_LOCALES]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.ENABLED_LOCALES]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.DEFAULT_LOCALE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FALLBACK_LOCALE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.ADMIN_DEFAULT_LOCALE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FRONTEND_DEFAULT_LOCALE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.LOCALE_URL_STRATEGY]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.MEASUREMENT_SYSTEM]: { scope: SettingScope.SITE, writable: true, exposed: true },

    // Security & Auth
    [SystemSettingRegistry.KEY.AUTH_SECURITY_NOTIFICATIONS]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_SESSION_DURATION]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.SSR_GENERATION_CAP]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.PLUGIN_ISOLATION_DEFAULT]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.PLUGIN_ISOLATION_MEMORY_MB]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.PLUGIN_ISOLATION_TIMEOUT_MS]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.SSR_RENDER_MEMORY_MB]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.QUEUE_JOB_ATTEMPTS]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.QUEUE_JOB_BACKOFF_MS]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.QUEUE_KEEP_COMPLETED]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.QUEUE_KEEP_FAILED]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.QUEUE_CONCURRENCY]: { scope: SettingScope.SITE, writable: false, exposed: true }, // candidate for PLATFORM (Phase 2)
    [SystemSettingRegistry.KEY.SSR_RENDER_TIMEOUT_MS]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_MIN_LENGTH]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_REQUIRE_NUMBER]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_REQUIRE_SYMBOL]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_HISTORY]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_BREACH_CHECK]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES]: { scope: SettingScope.SITE, writable: true, exposed: true },

    // Private file delivery
    [SystemSettingRegistry.KEY.FILE_SHARE_DEFAULT_EXPIRY_DAYS]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FILE_SHARE_DEFAULT_MAX_DOWNLOADS]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FILE_SHARE_RATE_LIMIT_PER_MINUTE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_LOCKOUT_THRESHOLD]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_LOCKOUT_WINDOW_MINUTES]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_LOCKOUT_DURATION_MINUTES]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_CAPTCHA_ENABLED]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUTH_CAPTCHA_THRESHOLD]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.TWO_FACTOR_ENABLED]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.RATE_LIMIT_MAX]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.RATE_LIMIT_MAX_AUTHENTICATED]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.RATE_LIMIT_MAX_INTERNAL]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.RATE_LIMIT_INTERNAL_CLIENTS]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.RATE_LIMIT_WINDOW]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES]: { scope: SettingScope.SITE, writable: true, exposed: true },

    // Routing & Features
    [SystemSettingRegistry.KEY.PERMALINK_STRUCTURE]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.ROUTING_HOME_TARGET]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FRONTEND_AUTH_ENABLED]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FRONTEND_REGISTRATION_ENABLED]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.EMAIL_NOTIFICATIONS]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.NOTIFICATION_EMAIL]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.NOTIFICATION_EMAIL_CC]: { scope: SettingScope.SITE, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.ADMIN_SEARCH_INDEXING]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.FRAMEWORK_REPOSITORY]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
    [SystemSettingRegistry.KEY.SOURCES_WORKSPACE_ROOT]: { scope: SettingScope.PLATFORM, writable: true, exposed: true },
  };

  private static platformKeysCache: string[] | null = null;
  private static writableKeysCache: Set<string> | null = null;
  private static exposedKeysCache: Set<string> | null = null;

  /** The descriptor for a declared key. Throws for anything not in `META_KEY` — never guesses. */
  static describe(key: SystemSettingKey): SystemSettingDescriptor {
    const descriptor = SystemSettingRegistry.REGISTRY[key];
    if (!descriptor) {
      throw new Error(`SystemSettingRegistry: "${key}" is not a declared system setting.`);
    }
    return descriptor;
  }

  static scopeOf(key: SystemSettingKey): SettingScope {
    return SystemSettingRegistry.describe(key).scope;
  }

  static isPlatform(key: SystemSettingKey): boolean {
    return SystemSettingRegistry.scopeOf(key).isPlatform;
  }

  /**
   * Is this key DECLARED and SITE-scoped? True only for a key the registry knows and marks SITE.
   *
   * An undeclared key answers FALSE rather than throwing, on purpose: `PlatformSettingsService`
   * also carries keys that never came from `META_KEY`, and the point of the guard is to catch a
   * scope MISMATCH, not to police every string that reaches the settings store.
   */
  static isDeclaredSiteScoped(key: string): boolean {
    const descriptor = (SystemSettingRegistry.REGISTRY as Record<string, SystemSettingDescriptor>)[key];
    return Boolean(descriptor) && !descriptor.scope.isPlatform;
  }

  /** Every declared key that may be returned to an admin client. */
  static exposedKeys(): Set<string> {
    if (!SystemSettingRegistry.exposedKeysCache) {
      SystemSettingRegistry.exposedKeysCache = new Set(
        Object.entries(SystemSettingRegistry.REGISTRY)
          .filter(([, descriptor]) => descriptor.exposed)
          .map(([key]) => key),
      );
    }
    return SystemSettingRegistry.exposedKeysCache;
  }

  static isWritable(key: string): boolean {
    return SystemSettingRegistry.writableKeys().has(key);
  }

  /** Every PLATFORM-scoped key. Deep-equal to the pre-registry 18-key list — see the guard test. */
  static platformKeys(): string[] {
    if (!SystemSettingRegistry.platformKeysCache) {
      SystemSettingRegistry.platformKeysCache = Object.entries(SystemSettingRegistry.REGISTRY)
        .filter(([, descriptor]) => descriptor.scope.isPlatform)
        .map(([key]) => key);
    }
    return [...SystemSettingRegistry.platformKeysCache];
  }

  /** Every key the generic settings PUT may accept. */
  static writableKeys(): Set<string> {
    if (!SystemSettingRegistry.writableKeysCache) {
      SystemSettingRegistry.writableKeysCache = new Set(
        Object.entries(SystemSettingRegistry.REGISTRY)
          .filter(([, descriptor]) => descriptor.writable)
          .map(([key]) => key),
      );
    }
    return SystemSettingRegistry.writableKeysCache;
  }
}
