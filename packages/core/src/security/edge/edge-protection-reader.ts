import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingRegistry } from '@core/settings/system-setting-registry';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { EdgeProtection } from '@core/security/edge/edge-protection';
import { EdgeSiteRules } from '@core/security/edge/edge-site-rules';

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
    const keys = SystemConstants.META_KEY;
    const everywhere = EdgeProtectionReader.isOn(this.platform(keys.EDGE_UNDER_ATTACK));
    const underAttack: Array<string | null> = everywhere ? [null] : [];
    const platformRules = new EdgeSiteRules(null, this.codes(this.platform(keys.EDGE_BLOCKED_COUNTRIES)), this.codes(this.platform(keys.EDGE_CHALLENGED_COUNTRIES)), EdgeProtectionReader.split(this.platform(keys.EDGE_BLOCKED_ADDRESSES)));
    const siteRules: EdgeSiteRules[] = platformRules.isEmpty ? [] : [platformRules];
    for (const siteId of siteIds) {
      const own = await this.siteValues(siteId);
      const attack = own.get(keys.EDGE_UNDER_ATTACK);
      if (attack !== undefined ? EdgeProtectionReader.isOn(attack) : everywhere) underAttack.push(siteId);
      // A site that set any of its own rules keeps its own list for each; an unset one inherits the platform's.
      const blocked = own.get(keys.EDGE_BLOCKED_COUNTRIES);
      const challenged = own.get(keys.EDGE_CHALLENGED_COUNTRIES);
      const addresses = own.get(keys.EDGE_BLOCKED_ADDRESSES);
      if (blocked === undefined && challenged === undefined && addresses === undefined) continue;
      siteRules.push(new EdgeSiteRules(
        siteId,
        blocked !== undefined ? this.codes(blocked) : platformRules.blockedCountries,
        challenged !== undefined ? this.codes(challenged) : platformRules.challengedCountries,
        addresses !== undefined ? EdgeProtectionReader.split(addresses) : platformRules.blockedAddresses,
      ));
    }
    const minutes = Number.parseInt(this.platform(SystemConstants.META_KEY.EDGE_CHALLENGE_CLEARANCE_MINUTES), 10);
    const limit = Number.parseInt(this.platform(SystemConstants.META_KEY.EDGE_RATE_LIMIT_PER_MINUTE), 10);
    return new EdgeProtection(
      underAttack,
      Number.isFinite(minutes) && minutes > 0 ? minutes : 0,
      this.lines(SystemConstants.META_KEY.EDGE_CHALLENGE_EXEMPT_PATHS),
      this.platform(SystemConstants.META_KEY.EDGE_CHALLENGE_TITLE),
      this.platform(SystemConstants.META_KEY.EDGE_CHALLENGE_MESSAGE),
      Number.isFinite(limit) && limit > 0 ? limit : 0,
      EdgeProtectionReader.isOn(this.platform(SystemConstants.META_KEY.EDGE_BLOCK_ATTACK_PATTERNS)),
      this.lines(SystemConstants.META_KEY.EDGE_BLOCKED_PATHS),
      this.lines(SystemConstants.META_KEY.EDGE_BLOCKED_USER_AGENTS),
      siteRules,
    );
  }

  /** A list setting: one entry per line (or comma), blanks dropped. */
  private lines(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): string[] {
    return EdgeProtectionReader.split(this.platform(key));
  }

  private static split(value: unknown): string[] {
    return String(value ?? '').split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
  }

  private codes(value: unknown): string[] {
    return EdgeProtectionReader.split(value).map((code) => code.toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code));
  }

  /** The site's own rows for the per-site edge keys, read in the site's scope (row-level security). */
  private async siteValues(siteId: string): Promise<Map<string, string>> {
    const keys = SystemConstants.META_KEY;
    const values = new Map<string, string>();
    await this.db.withTenant(siteId, async () => {
      for (const key of [keys.EDGE_UNDER_ATTACK, keys.EDGE_BLOCKED_COUNTRIES, keys.EDGE_CHALLENGED_COUNTRIES, keys.EDGE_BLOCKED_ADDRESSES]) {
        const row = await this.db.findOne(EdgeProtectionReader.TABLE, { key, tenant_id: siteId });
        if (row) values.set(key, String(row.value ?? ''));
      }
    });
    return values;
  }

  private platform(key: typeof SystemConstants.META_KEY[keyof typeof SystemConstants.META_KEY]): string {
    const saved = this.platformSettings.get(key);
    return String(saved ?? SystemSettingRegistry.defaultValueOf(key) ?? '');
  }

  private static isOn(value: unknown): boolean {
    return CoercionUtils.toBoolean(value, false) === true;
  }
}
