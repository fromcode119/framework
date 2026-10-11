import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@core/constants/system.constants';
import { EdgeProtection } from '@core/security/edge/edge-protection';
import { EdgeProtectionReader } from '@core/security/edge/edge-protection-reader';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

/** `_system_meta` rows, readable only inside the owning site's scope — as row-level security makes them. */
class ScopedMetaDb {
  private scope: string | null = null;
  constructor(private readonly rows: Array<{ key: string; tenant_id: string | null; value: string }>) {}
  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    this.scope = tenantId;
    try { return await fn(); } finally { this.scope = null; }
  }
  async findOne(_table: string, where: { key: string; tenant_id: string | null }): Promise<Record<string, unknown> | null> {
    return this.rows.find((row) => row.key === where.key && row.tenant_id === where.tenant_id && row.tenant_id === this.scope) ?? null;
  }
}

describe('EdgeProtectionReader', () => {
  const KEY = SystemConstants.META_KEY.EDGE_UNDER_ATTACK;

  it('the platform switch covers every site and the platform hosts; a site\'s own value overrides it', async () => {
    const db = new ScopedMetaDb([
      { key: KEY, tenant_id: 'shop', value: 'true' },
      { key: KEY, tenant_id: 'blog', value: 'false' },
    ]);
    const on = await new EdgeProtectionReader(db, new Map([[KEY, 'true']])).read(['shop', 'blog', 'quiet']);
    expect(on.isUnderAttack(null)).toBe(true);
    expect(on.isUnderAttack('quiet')).toBe(true);
    expect(on.isUnderAttack('shop')).toBe(true);
    expect(on.isUnderAttack('blog')).toBe(false);

    const off = await new EdgeProtectionReader(db, new Map([[KEY, 'false']])).read(['shop', 'blog', 'quiet']);
    expect(off.isUnderAttack(null)).toBe(false);
    expect(off.isUnderAttack('quiet')).toBe(false);
    expect(off.isUnderAttack('shop')).toBe(true);
    expect(off.isUnderAttack('blog')).toBe(false);
  });

  it('uses the declared defaults for anything nobody saved', async () => {
    const protection = await new EdgeProtectionReader(new ScopedMetaDb([]), new Map()).read([]);
    expect(protection.underAttack).toEqual([]);
    expect(protection.clearanceMinutes).toBe(720);
    expect(protection.exemptPaths).toEqual(['/api/', '/.well-known/']);
    expect(protection.title).toBe('Checking your browser');
    expect(protection.isExempt('/api/v1/health')).toBe(true);
    expect(protection.isExempt('/apiary')).toBe(false);
  });

  it('travels to the gateway with the routing map and comes back the same', () => {
    const protection = new EdgeProtection(['shop', null], 30, ['/api/'], 'T', 'M');
    const map = TenantRouteMap.fromJson(JSON.parse(JSON.stringify(new TenantRouteMap([]).withRelays(['198.51.100.1']).withProtection(protection))));
    expect(map.protection.toJSON()).toEqual(protection.toJSON());
    expect(map.relays).toEqual(['198.51.100.1']);
    expect(TenantRouteMap.fromJson({}).protection.isUnderAttack(null)).toBe(false);
  });
});
