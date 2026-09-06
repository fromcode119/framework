import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';

function fakeDb(tenants: Array<Record<string, unknown>>) {
  return {
    rows: tenants,
    find: vi.fn(async () => tenants.map((t) => ({ ...t }))),
    findOne: vi.fn(async (_table: string, where: any) => tenants.find((t) => t.id === where.id) ?? null),
    insert: vi.fn(async (_table: string, row: any) => { tenants.push({ ...row, host_aliases: row.host_aliases }); return row; }),
    update: vi.fn(async (_table: string, where: any, patch: any) => { Object.assign(tenants.find((t) => t.id === where.id) as any, patch); return {}; }),
    delete: vi.fn(async () => true),
  } as any;
}

const EXISTING = { id: 't1', slug: 'acme', primary_host: 'acme.test', host_aliases: ['www.acme.test'], state: 'active' };

afterEach(() => {
  PluginTenantAccess.reset();
  TenantThemeAccess.reset();
});

describe('TenantRegistryService', () => {
  it('refuses a host another tenant already routes — including one of its ALIASES', async () => {
    const service = new TenantRegistryService(fakeDb([{ ...EXISTING }]), new TenantResolverService(fakeDb([])));
    await expect(service.create(TenantIdentity.from({ kind: 'site', slug: 'globex', primaryHost: 'www.acme.test' }))).rejects.toThrow(/already routes to tenant "acme"/);
    await expect(service.create(TenantIdentity.from({ kind: 'site', slug: 'acme', primaryHost: 'other.test' }))).rejects.toThrow(/slug "acme"/);
  });

  it('invalidates the LIVE resolver on every write, so routing follows without a restart', async () => {
    const db = fakeDb([{ ...EXISTING }]);
    const resolver = new TenantResolverService(db);
    expect((await resolver.resolveByHost('acme.test'))?.id).toBe('t1');
    const spy = vi.spyOn(resolver, 'invalidate');

    const service = new TenantRegistryService(db, resolver);
    await service.create(TenantIdentity.from({ kind: 'site', slug: 'globex', primaryHost: 'globex.test' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await resolver.resolveByHost('globex.test'))?.slug).toBe('globex');

    await service.update('t1', { state: 'suspended' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await resolver.resolveByHost('acme.test'))?.isActive).toBe(false);
  });

  it('lets an update keep its own hosts while still refusing another tenant\'s', async () => {
    const db = fakeDb([{ ...EXISTING }, { id: 't2', slug: 'globex', primary_host: 'globex.test', host_aliases: [], state: 'active' }]);
    const service = new TenantRegistryService(db, new TenantResolverService(db));
    await expect(service.update('t1', { hostAliases: ['www.acme.test', 'shop.acme.test'] })).resolves.toBeTruthy();
    await expect(service.update('t1', { hostAliases: ['globex.test'] })).rejects.toThrow(/already routes to tenant "globex"/);
  });

  it('remove() clears the tenant\'s configuration rows and the registry row', async () => {
    const db = fakeDb([{ ...EXISTING }]);
    await new TenantRegistryService(db, new TenantResolverService(db)).remove('t1');
    const tables = db.delete.mock.calls.map((call: any[]) => call[0]);
    expect(tables).toEqual(['_system_tenant_plugins', '_system_tenant_themes', '_system_tenant_memberships', '_system_tenants']);
  });
});
