import { ApplicationDomainSettingsUtils, CoercionUtils, RequestContextUtils, SystemConstants, SystemSettingsExposureUtils, TenantMode, TenantResolverService } from '@fromcode119/core';
import { SystemSettingRegistry } from '@fromcode119/core';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

/**
 * Deciding what a settings PUT is allowed to change, and writing it.
 *
 * Writability is declared per key in the registry, not inferred: `_system_meta` holds live SMTP and
 * gateway passwords beside the operator-visible settings, so a generic PUT that accepted any key
 * would accept those too. The writable set is read from the registry every time rather than cached,
 * because a key added to the registry must not need a restart to become settable.
 *
 * The audit-retention floor is enforced here as well. Shortening the window below it is how an
 * operator would erase their own trail, so a payload asking for less is refused rather than clamped
 * — clamping would accept the request and quietly do something else.
 *
 * Split out of `SystemSettingsController` (343 lines), which handles the requests.
 */
export class SystemSettingsWriter {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  /**
   * Which keys this PUT may accept, DERIVED from the registry rather than listed here.
   *
   * This was a hand-written set, and omitting a key did not merely lose that key — the whole PUT
   * answered 400 and NOTHING on the page saved. It is the same failure mode as scope being an
   * omission, one layer up, so it has the same answer: declare it once, next to the scope, and
   * derive. Verified identical to the list it replaces (69 keys, no difference either way).
   */
  static writableKeys(): Set<string> {
    return SystemSettingRegistry.writableKeys();
  }


  /**
   * The requested audit window when it is positive and below the floor, or `null` when there is
   * nothing to refuse. Empty and 0 mean KEEP FOREVER and are always fine.
   */
  static auditWindowBelowFloor(payload: Record<string, unknown>): number | null {
    const key = SystemConstants.META_KEY.AUDIT_RETENTION_DAYS;
    if (!(key in payload)) return null;
    const requested = Math.floor(CoercionUtils.toNumber(payload[key], 0));
    if (requested <= 0 || requested >= SystemConstants.AUDIT_RETENTION_MIN_DAYS) return null;
    return requested;
  }

  /** Single-tenant: every admin is the platform. Multi-tenant: only a flagged account. */
  /** The platform row (`tenant_id IS NULL`) of a platform key, upserted under the platform-admin marker. Returns the previous value. */
  async writePlatformSetting(key: string, value: string, timestamp: Date): Promise<string | undefined> {
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

  async prepareSettingsPayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
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


  hasPrimaryDomainChange(payload: Record<string, unknown>): boolean {
    return [
      SystemConstants.META_KEY.SITE_URL,
      SystemConstants.META_KEY.FRONTEND_URL,
      SystemConstants.META_KEY.ADMIN_URL,
      SystemConstants.META_KEY.PLATFORM_DOMAIN,
    ].some((key) => key in payload);
  }


  async readCurrentDomainSettings(): Promise<Record<string, string>> {
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
