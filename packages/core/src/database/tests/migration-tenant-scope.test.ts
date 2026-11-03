import { afterEach, describe, expect, it, vi } from 'vitest';
import { MigrationTenantScope } from '@core/database/migration-tenant-scope';
import { TenantMode } from '@core/tenant/tenant-mode';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * The regression this guards: a plugin DATA migration ran with no site bound, so on a multi-tenant
 * deployment row-level security hid every tenant-owned row — `find` returned nothing, `update` matched
 * nothing, and the migration was recorded as done having changed nothing.
 */
class ScopeFixture {
  readonly bound: string[] = [];

  /** A manager whose `withTenant` records the site it bound, and whose tenants table holds `ids`. */
  db(ids: string[], options: { isolation?: boolean; tenantsTable?: boolean } = {}): any {
    return {
      supportsTenantIsolation: () => options.isolation ?? true,
      tableExists: vi.fn(async () => options.tenantsTable ?? true),
      withPlatformAdmin: (fn: () => Promise<unknown>) => fn(),
      find: vi.fn(async () => ids.map((id) => ({ id }))),
      withTenant: async (tenantId: string, fn: () => Promise<unknown>) => {
        this.bound.push(tenantId);
        return fn();
      },
    };
  }
}

afterEach(() => vi.restoreAllMocks());

describe('MigrationTenantScope', () => {
  it('runs the callback once per site, with that site bound in the database AND the request context', async () => {
    const fixture = new ScopeFixture();
    const seen: Array<{ tenantId: string; context: unknown }> = [];

    await new MigrationTenantScope(fixture.db(['alpha', 'beta'])).forEachTenant(async (tenantId) => {
      seen.push({ tenantId, context: RequestContextUtils.storage.getStore()?.tenantId });
    });

    expect(fixture.bound).toEqual(['alpha', 'beta']);
    expect(seen).toEqual([{ tenantId: 'alpha', context: 'alpha' }, { tenantId: 'beta', context: 'beta' }]);
  });

  it('binds each site at boot too, before TenantMode is configured', async () => {
    // Core migrations run before boot configures TenantMode, which then still says single-tenant.
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const fixture = new ScopeFixture();
    const calls: string[] = [];

    await new MigrationTenantScope(fixture.db(['alpha', 'beta'])).forEachTenant(async (tenantId) => { calls.push(tenantId); });

    expect(calls).toEqual(['alpha', 'beta']);
    expect(fixture.bound).toEqual(['alpha', 'beta']);
  });

  it('runs once, unscoped, on a deployment with no sites', async () => {
    const fixture = new ScopeFixture();
    const calls: string[] = [];

    await new MigrationTenantScope(fixture.db([])).forEachTenant(async (tenantId) => { calls.push(tenantId); });

    expect(calls).toEqual(['']);
    expect(fixture.bound).toEqual([]);
  });

  it('runs once, unscoped, on a driver without isolation or before the tenants table exists', async () => {
    for (const options of [{ isolation: false }, { tenantsTable: false }]) {
      const fixture = new ScopeFixture();
      const db = fixture.db(['ignored'], options);
      const calls: string[] = [];

      await new MigrationTenantScope(db).forEachTenant(async (tenantId) => { calls.push(tenantId); });

      expect(calls).toEqual(['']);
      expect(fixture.bound).toEqual([]);
      expect(db.find).not.toHaveBeenCalled();
    }
  });

  it('stops at the first site that fails, so the migration is not recorded as done', async () => {
    const fixture = new ScopeFixture();
    const calls: string[] = [];

    await expect(new MigrationTenantScope(fixture.db(['alpha', 'beta'])).forEachTenant(async (tenantId) => {
      calls.push(tenantId);
      throw new Error(`boom ${tenantId}`);
    })).rejects.toThrow('boom alpha');
    expect(calls).toEqual(['alpha']);
  });
});
