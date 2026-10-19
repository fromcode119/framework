import { SystemConstants } from '@core/constants/system.constants';
import type { IDatabaseManager } from '@fromcode119/database';

/**
 * Which site or workspace owns each external key a plugin's platform part receives traffic for
 * (`_system_plugin_claims`). Framework-only, on the raw connection: no plugin reads this table.
 *
 * One key, one owner. A key another owner holds is refused, never moved — moving it would let any site
 * that can complete a provider's sign-in take over another site's account. The owner gives it up
 * ({@link release}) before anyone else can have it. `tenantId` is null on an installation with no tenants.
 */
export class PluginPlatformClaims {
  constructor(private readonly db: IDatabaseManager) {}

  /** The owner of `key`: `{ tenantId }` (null on an untenanted installation), or null when nobody owns it. */
  async ownerOf(slug: string, key: string): Promise<{ tenantId: string | null } | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.PLUGIN_CLAIMS, { plugin_slug: slug, claim_key: key });
    return row ? { tenantId: row.tenant_id ? String(row.tenant_id) : null } : null;
  }

  async claim(slug: string, tenantId: string | null, keys: string[]): Promise<{ granted: string[]; refused: string[] }> {
    const granted: string[] = [];
    const refused: string[] = [];
    for (const key of PluginPlatformClaims.normalise(keys)) {
      const owner = await this.ownerOf(slug, key);
      if (owner) {
        (owner.tenantId === tenantId ? granted : refused).push(key);
        continue;
      }
      try {
        await this.db.insert(SystemConstants.TABLE.PLUGIN_CLAIMS, { plugin_slug: slug, claim_key: key, tenant_id: tenantId, created_at: new Date() });
        granted.push(key);
      } catch {
        // Lost a race to the unique index: whoever won owns it now.
        const winner = await this.ownerOf(slug, key);
        (winner && winner.tenantId === tenantId ? granted : refused).push(key);
      }
    }
    return { granted, refused };
  }

  async keysOf(slug: string, tenantId: string | null): Promise<string[]> {
    const rows = await this.db.find(SystemConstants.TABLE.PLUGIN_CLAIMS, { where: { plugin_slug: slug, tenant_id: tenantId } });
    return (rows ?? []).map((row: any) => String(row.claim_key));
  }

  /** Gives up `keys` (every key the owner holds when omitted). Returns how many were released. */
  async release(slug: string, tenantId: string | null, keys?: string[]): Promise<number> {
    const owned = await this.keysOf(slug, tenantId);
    const targets = keys ? PluginPlatformClaims.normalise(keys).filter((key) => owned.includes(key)) : owned;
    for (const key of targets) {
      await this.db.delete(SystemConstants.TABLE.PLUGIN_CLAIMS, { plugin_slug: slug, claim_key: key, tenant_id: tenantId });
    }
    return targets.length;
  }

  private static normalise(keys: string[]): string[] {
    return [...new Set((keys ?? []).map((key) => String(key ?? '').trim()).filter(Boolean))];
  }
}
