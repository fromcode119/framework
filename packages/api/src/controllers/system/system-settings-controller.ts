import { AuditOutcome } from '@fromcode119/core';
import { TenantBespokePolicies } from '@fromcode119/core';
import { Request, Response } from 'express';
import { ApplicationDomainSettingsUtils, CoercionUtils, RequestContextUtils, SystemConstants, SystemSettingsExposureUtils, TenantMode, TenantResolverService } from '@fromcode119/core';
import { Logger } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { SystemSettingRegistry } from '@fromcode119/core';

/**
 * Reading and writing PLATFORM settings, including which keys a tenant admin may write at all.
 *
 * The writable-key allowlist is the security boundary here: everything not in it is platform-only.
 *
 * Split out of SystemAdminController (531 lines) 2026-09-09 — one concern per controller, matching the
 * other system controllers. Composed by SystemController with the same runtime.
 */
export class SystemSettingsController {
  private readonly logger = new Logger({ namespace: 'system-settings' });

  constructor(private readonly runtime: SystemControllerRuntime) {}

  /**
   * Which keys this PUT may accept, DERIVED from the registry rather than listed here.
   *
   * This was a hand-written set, and omitting a key did not merely lose that key — the whole PUT
   * answered 400 and NOTHING on the page saved. It is the same failure mode as scope being an
   * omission, one layer up, so it has the same answer: declare it once, next to the scope, and
   * derive. Verified identical to the list it replaces (69 keys, no difference either way).
   */
  private static writableKeys(): Set<string> {
    return SystemSettingRegistry.writableKeys();
  }


  /**
   * The requested audit window when it is positive and below the floor, or `null` when there is
   * nothing to refuse. Empty and 0 mean KEEP FOREVER and are always fine.
   */
  private static auditWindowBelowFloor(payload: Record<string, unknown>): number | null {
    const key = SystemConstants.META_KEY.AUDIT_RETENTION_DAYS;
    if (!(key in payload)) return null;
    const requested = Math.floor(CoercionUtils.toNumber(payload[key], 0));
    if (requested <= 0 || requested >= SystemConstants.AUDIT_RETENTION_MIN_DAYS) return null;
    return requested;
  }

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
      const tenantMode = TenantMode.isEnabled();
      const editable = !tenantMode || await this.runtime.isPlatformAdmin(req);
      // `tenantMode` so the admin can say WHICH settings are platform-wide even to someone allowed to
      // change them. On a single-tenant deployment there is no second scope to contrast with, so the
      // distinction is noise and the admin shows nothing.
      //
      // `siteSelected` is the OTHER half of the same question, and it was missing: with no site
      // chosen, `updateSettings` below refuses the whole PUT if it carries even one per-site key.
      // Without this fact the admin could not tell which of its fields those were, so it sent them
      // all and nothing saved. Same source as the refusal itself — the request's own tenant.
      const siteSelected = Boolean(RequestContextUtils.getTenantId());
      res.json({ keys: TenantBespokePolicies.platformKeys(), editable, tenantMode, siteSelected });
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

      const unknownKeys = Object.keys(payload).filter((k) => !SystemSettingsController.writableKeys().has(k));
      if (unknownKeys.length > 0) {
        return res.status(400).json({ error: `Unknown or read-only settings key(s): ${unknownKeys.join(', ')}` });
      }

      const preparedPayload = await this.prepareSettingsPayload(payload as Record<string, unknown>);

      // The audit window has a FLOOR, and it is refused here rather than clamped. `packages/ai`
      // declares `_system_audit_logs` the EU AI Act Art. 12 record-keeping store, so a window shorter
      // than the six months that record is expected to survive would let the platform quietly break a
      // commitment its own code makes. Silently storing 180 when the operator asked for 30 would be
      // worse than refusing: they would believe they had 30. Keeping forever (empty) stays allowed.
      const auditFloor = SystemSettingsController.auditWindowBelowFloor(preparedPayload);
      if (auditFloor !== null) {
        return res.status(400).json({
          error: 'audit_retention_below_minimum',
          message: `The audit trail must be kept for at least ${SystemConstants.AUDIT_RETENTION_MIN_DAYS} days —`
            + ` ${auditFloor} is too short. It records security denials, settings changes and AI invocations,`
            + ' and is this platform\'s EU AI Act record. Leave it empty to keep the audit trail forever.',
          key: SystemConstants.META_KEY.AUDIT_RETENTION_DAYS,
          minimumDays: SystemConstants.AUDIT_RETENTION_MIN_DAYS,
        });
      }
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
      // A PER-SITE key needs a site. With none selected on a multi-site platform there is no row it
      // could belong to: the `_system_meta` policy accepts a tenant-less row only from a platform
      // write, so the insert is refused by the database and the whole save 500s — naming no key and
      // logging nothing. Refused here instead, saying which keys and what to do, because a control
      // that appears to save and cannot is exactly the magic this codebase forbids.
      const siteless = TenantMode.isEnabled() && !RequestContextUtils.getTenantId();
      const perSite = Object.keys(preparedPayload).filter((key) => !platformKeys.has(key));
      if (siteless && perSite.length > 0) {
        return res.status(400).json({
          error: 'site_required',
          message: `Setting(s) ${perSite.join(', ')} belong to a site. Choose a site first — with none selected only platform settings can be changed.`,
          keys: perSite,
        });
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
      // LOGGED. This catch was silent, so a settings save the database refused left a 500 in the
      // browser and NOTHING on the server — the cause could only be found by replaying the request.
      this.logger.error(`Failed to update settings: ${error?.message ?? error}`, error);
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
