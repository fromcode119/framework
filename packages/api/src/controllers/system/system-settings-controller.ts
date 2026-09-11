import { AuditOutcome } from '@fromcode119/core';
import { TenantBespokePolicies } from '@fromcode119/core';
import { Request, Response } from 'express';
import { ApplicationDomainSettingsUtils, RequestContextUtils, SystemConstants, SystemSettingsExposureUtils, TenantMode, TenantResolverService } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/**
 * Reading and writing PLATFORM settings, including which keys a tenant admin may write at all.
 *
 * The writable-key allowlist is the security boundary here: everything not in it is platform-only.
 *
 * Split out of SystemAdminController (531 lines) 2026-09-09 — one concern per controller, matching the
 * other system controllers. Composed by SystemController with the same runtime.
 */
export class SystemSettingsController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  private static readonly WRITABLE_SETTINGS_KEYS = new Set<string>([
  SystemConstants.META_KEY.MAINTENANCE_MODE,
  SystemConstants.META_KEY.PLUGIN_ISOLATION_DEFAULT,
  SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB,
  SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS,
  SystemConstants.META_KEY.MCP_REMOTE_ENABLED,
  SystemConstants.META_KEY.MCP_REMOTE_MEDIA_MAX_MB,
  SystemConstants.META_KEY.SITE_NAME,
  SystemConstants.META_KEY.SITE_URL,
  SystemConstants.META_KEY.FRONTEND_URL,
  SystemConstants.META_KEY.ADMIN_URL,
  SystemConstants.META_KEY.MARKETPLACE_URL,
  SystemConstants.META_KEY.DOMAIN_ALIASES,
  SystemConstants.META_KEY.TIMEZONE,
  SystemConstants.META_KEY.ADMIN_APPEARANCE,
  SystemConstants.META_KEY.ADMIN_SHADOWS,
  SystemConstants.META_KEY.PLATFORM_NAME,
  SystemConstants.META_KEY.PLATFORM_DOMAIN,
  SystemConstants.META_KEY.TELEMETRY_ENABLED,
  // Settings → General → Search Engines. Every save from that page carries this key, so leaving it
  // out does not merely lose the toggle — the whole PUT 400s and NOTHING on the page saves.
  SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING,
  // Settings → Infrastructure → System Logs. Without this the field saves "successfully" from the
  // admin's point of view and the PUT 400s — the silent-loss class named a few lines below.
  SystemConstants.META_KEY.LOG_RETENTION_DAYS,
  // Settings → Infrastructure → Server rendering: how many theme+plugin worlds the storefront keeps.
  SystemConstants.META_KEY.SSR_GENERATION_CAP,
  SystemConstants.META_KEY.SSR_RENDER_MEMORY_MB,
  SystemConstants.META_KEY.SSR_RENDER_TIMEOUT_MS,
  SystemConstants.META_KEY.LOCALIZATION_LOCALES,
  SystemConstants.META_KEY.ENABLED_LOCALES,
  SystemConstants.META_KEY.DEFAULT_LOCALE,
  SystemConstants.META_KEY.FALLBACK_LOCALE,
  SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE,
  SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE,
  SystemConstants.META_KEY.LOCALE_URL_STRATEGY,
  // Localization → Measurement System. The control existed and reported success while the PUT never
  // carried the key; with the admin now sending it, omitting it here turns that silent loss into a 400.
  // Read live by plugins that size or weigh things, via `globalSettings.measurement_system`.
  SystemConstants.META_KEY.MEASUREMENT_SYSTEM,
  SystemConstants.META_KEY.PERMALINK_STRUCTURE,
  SystemConstants.META_KEY.ROUTING_HOME_TARGET,
  SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED,
  SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED,
  SystemConstants.META_KEY.EMAIL_NOTIFICATIONS,
  SystemConstants.META_KEY.NOTIFICATION_EMAIL,
  SystemConstants.META_KEY.NOTIFICATION_EMAIL_CC,
  // Security group (admin Settings → Security) — all consumed: rate limit by the rate-limit middleware,
  // session duration by the auth policy, and the 2FA toggle gates new enrolment in SystemTwoFactorService.
  SystemConstants.META_KEY.RATE_LIMIT_MAX,
  SystemConstants.META_KEY.RATE_LIMIT_MAX_AUTHENTICATED,
  SystemConstants.META_KEY.RATE_LIMIT_MAX_INTERNAL,
  SystemConstants.META_KEY.RATE_LIMIT_INTERNAL_CLIENTS,
  SystemConstants.META_KEY.RATE_LIMIT_WINDOW,
  // Audit-trail exclusions — read by DatabaseWriteAudit on every plugin context.db write; the
  // Security screen's control saves it here.
  SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES,
  SystemConstants.META_KEY.AUTH_SESSION_DURATION,
  SystemConstants.META_KEY.TWO_FACTOR_ENABLED,
  // Password policy — read on every registration / password change / reset by
  // `AuthControllerPolicy.getPasswordPolicySettings()` + `validatePasswordAgainstPolicy()`. These were
  // seeded with operator-facing descriptions and ENFORCED live, but rejected here with a 400 and
  // rendered nowhere: the platform imposed a password policy nobody could see or change, and only
  // direct SQL could move it. Controls now live on admin Settings → Security → Password Policy.
  SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH,
  SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE,
  SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE,
  SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER,
  SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL,
  SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY,
  SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK,
  // Login throttle / lockout — read by `AuthControllerPolicy.getLoginThrottleSettings()` and applied
  // on every failed login (`recordLoginFailure`, `isLoginLocked`, `requiresCaptcha`).
  SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD,
  SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES,
  SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES,
  SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED,
  SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD,
  // Token lifetimes — read by `AuthControllerTokenSupport` when a reset / email-change link is issued.
  SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES,
  SystemConstants.META_KEY.FILE_SHARE_DEFAULT_EXPIRY_DAYS,
  SystemConstants.META_KEY.FILE_SHARE_DEFAULT_MAX_DOWNLOADS,
  SystemConstants.META_KEY.FILE_SHARE_RATE_LIMIT_PER_MINUTE,
  SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES,
  // Security notification emails — read by `AuthControllerEmailInfrastructure` and `System2faService`.
  SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS,
]);


  /** Single-tenant: every admin is the platform. Multi-tenant: only a flagged account. */
  /** The platform row (`tenant_id IS NULL`) of a platform key, upserted under the platform-admin marker. Returns the previous value. */
  private async writePlatformSetting(key: string, value: string, timestamp: Date): Promise<string | undefined> {
    return this.runtime.db.withPlatformAdmin(async () => {
      const table = SystemConstants.TABLE.META;
      const rows = await this.runtime.db.queryRaw(`SELECT "value" FROM "${table}" WHERE "key" = $1 AND "tenant_id" IS NULL LIMIT 1`, [key]);
      const previous = rows[0] ? String(rows[0].value ?? '') : undefined;
      await this.runtime.db.queryRaw(
        `INSERT INTO "${table}" ("key", "value", "updated_at", "tenant_id") VALUES ($1, $2, $3, NULL) `
        + 'ON CONFLICT ("key", "tenant_id") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = EXCLUDED."updated_at"',
        [key, value, timestamp],
      );
      return previous;
    });
  }


  /**
   * The declared, operator-visible system settings. `_system_meta` is a key/value scratch space, not a
   * settings table — returning it raw disclosed the whole `integration_email_profiles` credential blob
   * (SMTP host/user + the password field, ciphertext only for values written since SecretService landed;
   * `SecretService.decrypt` still passes legacy unencrypted values through) plus every user's TOTP secret
   * and recovery codes and the SCIM/API machine tokens. The exposable set is
   * framework-owned (see {@link SystemSettingsExposureUtils}), so nothing new leaks by being written.
   */
  async getSettings(_req: Request, res: Response) {
    try {
      const settings = await this.runtime.db.find(SystemConstants.TABLE.META);
      res.json(SystemSettingsExposureUtils.toExposableSettingsMap(settings, { parseJson: true }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  /**
   * Which settings belong to the PLATFORM, and whether this account may change them.
   *
   * `updateSettings` already refuses a platform key from a site administrator, but the admin cannot
   * render an honest form from a refusal it only learns about after pressing Save — a control that
   * cannot act is a bug. The list comes from `TenantBespokePolicies`, the same definition the RLS
   * policy and the tenant importer read, so the admin never carries a second copy to drift from.
   */
  async platformSettingKeys(req: Request, res: Response) {
    try {
      const editable = !TenantMode.isEnabled() || await this.runtime.isPlatformAdmin(req);
      res.json({ keys: TenantBespokePolicies.platformKeys(), editable });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async updateSettings(req: Request, res: Response) {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ error: 'Settings payload must be an object.' });
      }

      const unknownKeys = Object.keys(payload).filter((k) => !SystemSettingsController.WRITABLE_SETTINGS_KEYS.has(k));
      if (unknownKeys.length > 0) {
        return res.status(400).json({ error: `Unknown or read-only settings key(s): ${unknownKeys.join(', ')}` });
      }

      const preparedPayload = await this.prepareSettingsPayload(payload as Record<string, unknown>);
      const timestamp = new Date();

      const actor = (req as any).user || {};
      // A PLATFORM key (deployment truths: URLs, maintenance, render and isolation limits) belongs to
      // the platform row, whichever site the admin happens to have selected. Writing it under the
      // request's tenant made the setting per-site by accident: that site read it, every other site
      // saw the default. Only a platform admin may write that row — and on a multi-site platform a
      // site admin may not write it AT ALL: a site row of a platform key is read by nothing, so
      // accepting it would be a control that silently does nothing. Refused, with the reason.
      const platformKeys = new Set(TenantBespokePolicies.platformKeys());
      const platformAdmin = await this.runtime.isPlatformAdmin(req);
      const refused = Object.keys(preparedPayload).filter((key) => platformKeys.has(key));
      if (refused.length > 0 && TenantMode.isEnabled() && !platformAdmin) {
        return res.status(403).json({ error: 'platform_admin_required', message: `Platform setting(s) ${refused.join(', ')} apply to every site and only a platform admin may change them.`, keys: refused });
      }
      // A WORKSPACE's appearance is carried by its kind (T6 §3.3): no setting exists for it, so a
      // write is refused rather than stored where nothing reads it.
      if (SystemConstants.META_KEY.ADMIN_APPEARANCE in preparedPayload && TenantMode.isEnabled()) {
        const tenantId = RequestContextUtils.getTenantId();
        const tenant = tenantId ? await TenantResolverService.shared(this.runtime.db).resolveById(tenantId) : null;
        if (tenant?.isWorkspace) {
          return res.status(403).json({ error: 'kind_locks_appearance', message: `"${tenant.slug}" is a workspace: its console is locked to "${tenant.appearance || 'default'}" by its kind.` });
        }
      }
      const asPlatform = platformAdmin && this.runtime.db.dialect === 'postgres';
      for (const [key, value] of Object.entries(preparedPayload)) {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
        let previousValue: string | undefined;
        if (asPlatform && platformKeys.has(key)) {
          previousValue = await this.writePlatformSetting(key, serializedValue, timestamp);
        } else {
          const existing = await this.runtime.db.findOne(SystemConstants.TABLE.META, { key });
          previousValue = existing ? String((existing as any).value ?? '') : undefined;
          if (existing) {
            await this.runtime.db.update(SystemConstants.TABLE.META, { key }, { value: serializedValue, updated_at: timestamp });
          } else {
            await this.runtime.db.insert(SystemConstants.TABLE.META, { key, value: serializedValue, updated_at: timestamp });
          }
        }

        // Audit every setting change WITH the actor + old→new. This is what finally attributes
        // "who flipped admin_appearance" — and every other settings mystery — to a person.
        if (previousValue !== serializedValue) {
          void this.runtime.manager.audit.logAction('system', 'settings.update', key, AuditOutcome.ALLOWED, {
            userId: actor.id, email: actor.email, from: previousValue ?? null, to: serializedValue,
          });
        }
      }

      // Announce the settings change so in-process caches (e.g. the route-resolution
      // permalink-structure cache) can invalidate immediately instead of waiting out a TTL.
      this.runtime.manager.hooks.emit('system:settings:updated', { keys: Object.keys(preparedPayload) });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  private async prepareSettingsPayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const nextPayload = { ...payload };
    if (!this.hasPrimaryDomainChange(payload) && !(SystemConstants.META_KEY.DOMAIN_ALIASES in payload)) {
      return nextPayload;
    }

    const currentSettings = await this.readCurrentDomainSettings();
    const mergedAliases = ApplicationDomainSettingsUtils.mergeDomainAliasesForPrimaryChange({
      currentAliases:
        SystemConstants.META_KEY.DOMAIN_ALIASES in payload
          ? payload[SystemConstants.META_KEY.DOMAIN_ALIASES]
          : currentSettings.domainAliases,
      previousValues: [
        currentSettings.siteUrl,
        currentSettings.frontendUrl,
        currentSettings.adminUrl,
        currentSettings.platformDomain,
      ],
      nextValues: [
        nextPayload[SystemConstants.META_KEY.SITE_URL] ?? currentSettings.siteUrl,
        nextPayload[SystemConstants.META_KEY.FRONTEND_URL] ?? currentSettings.frontendUrl,
        nextPayload[SystemConstants.META_KEY.ADMIN_URL] ?? currentSettings.adminUrl,
        nextPayload[SystemConstants.META_KEY.PLATFORM_DOMAIN] ?? currentSettings.platformDomain,
      ],
    });

    if (mergedAliases.length > 0 || SystemConstants.META_KEY.DOMAIN_ALIASES in payload) {
      nextPayload[SystemConstants.META_KEY.DOMAIN_ALIASES] = mergedAliases;
    }

    return nextPayload;
  }


  private hasPrimaryDomainChange(payload: Record<string, unknown>): boolean {
    return [
      SystemConstants.META_KEY.SITE_URL,
      SystemConstants.META_KEY.FRONTEND_URL,
      SystemConstants.META_KEY.ADMIN_URL,
      SystemConstants.META_KEY.PLATFORM_DOMAIN,
    ].some((key) => key in payload);
  }


  private async readCurrentDomainSettings(): Promise<Record<string, string>> {
    const keys = [
      SystemConstants.META_KEY.SITE_URL,
      SystemConstants.META_KEY.FRONTEND_URL,
      SystemConstants.META_KEY.ADMIN_URL,
      SystemConstants.META_KEY.PLATFORM_DOMAIN,
      SystemConstants.META_KEY.DOMAIN_ALIASES,
    ];
    const settings = await Promise.all(
      keys.map((key) => this.runtime.db.findOne(SystemConstants.TABLE.META, { key })),
    );

    return {
      siteUrl: String(settings[0]?.value || ''),
      frontendUrl: String(settings[1]?.value || ''),
      adminUrl: String(settings[2]?.value || ''),
      platformDomain: String(settings[3]?.value || ''),
      domainAliases: String(settings[4]?.value || ''),
    };
  }
}
