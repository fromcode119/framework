import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { EdgeProtection } from '@core/security/edge/edge-protection';

/**
 * Builds the gateway's {@link EdgeProtection} from the settings.
 *
 * The platform-wide values come from the api's settings cache (platform rows). "Under attack" is
 * inherited: a site's own row, read inside the site's scope because row-level security hides it from
 * any other, wins; a site without one follows the platform's switch, which also covers the platform's
 * own hosts. A value nobody saved falls back to the setting's declared default — the same one the
 * admin shows.
 */
export class EdgeProtectionReader {
  private static readonly TABLE = SystemConstants.TABLE.META;

  constructor(
    /** The raw database manager: `withTenant`, `findOne`. */
    private readonly db: any,
    private readonly platformSettings: Map<string, string>,
  ) {}

  async read(siteIds: readonly string[]): Promise<EdgeProtection> {
    const key = SystemConstants.META_KEY.EDGE_UNDER_ATTACK;
    const everywhere = EdgeProtectionReader.isOn(this.platform(key));
    const underAttack: Array<string | null> = everywhere ? [null] : [];
    for (const siteId of siteIds) {
      const row = await this.db.withTenant(siteId, () => this.db.findOne(EdgeProtectionReader.TABLE, { key, tenant_id: siteId }));
      if (row ? EdgeProtectionReader.isOn(row.value) : everywhere) underAttack.push(siteId);
    }
    const minutes = Number.parseInt(this.platform(SystemConstants.META_KEY.EDGE_CHALLENGE_CLEARANCE_MINUTES), 10);
    const limit = Number.parseInt(this.platform(SystemConstants.META_KEY.EDGE_RATE_LIMIT_PER_MINUTE), 10);
    return new EdgeProtection(
      underAttack,
      Number.isFinite(minutes) && minutes > 0 ? minutes : 0,
      this.platform(SystemConstants.META_KEY.EDGE_CHALLENGE_EXEMPT_PATHS).split(/\r?\n|,/).map((path) => path.trim()).filter(Boolean),
      this.platform(SystemConstants.META_KEY.EDGE_CHALLENGE_TITLE),
      this.platform(SystemConstants.META_KEY.EDGE_CHALLENGE_MESSAGE),
      Number.isFinite(limit) && limit > 0 ? limit : 0,
    );
  }

  private platform(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): string {
    const saved = this.platformSettings.get(key);
    return String(saved ?? SystemSettingRegistry.defaultValueOf(key) ?? '');
  }

  private static isOn(value: unknown): boolean {
    return CoercionUtils.toBoolean(value, false) === true;
  }
}
