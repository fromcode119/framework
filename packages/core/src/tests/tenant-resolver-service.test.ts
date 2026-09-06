import { describe, expect, it, vi } from 'vitest';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

const rows = [
  { id: 't1', slug: 'acme', primary_host: 'acme.test', host_aliases: ['www.acme.test'], state: 'active' },
  { id: 't2', slug: 'globex', primary_host: 'globex.test', host_aliases: [], state: 'active' },
  { id: 't3', slug: 'old', primary_host: 'old.test', host_aliases: [], state: 'suspended' },
];

function fakeDb() {
  return { find: vi.fn(async () => rows.map((row) => ({ ...row }))) };
}

describe('TenantResolverService', () => {
  it('resolves a tenant by its primary host', async () => {
    const service = new TenantResolverService(fakeDb());
    expect((await service.resolveByHost('acme.test'))?.id).toBe('t1');
  });

  it('resolves a tenant by an alias host', async () => {
    const service = new TenantResolverService(fakeDb());
    expect((await service.resolveByHost('www.acme.test'))?.id).toBe('t1');
  });

  it('returns null for an unknown host — never a default tenant', async () => {
    const service = new TenantResolverService(fakeDb());
    expect(await service.resolveByHost('nobody.test')).toBeNull();
  });

  it('returns null for an empty host', async () => {
    const service = new TenantResolverService(fakeDb());
    expect(await service.resolveByHost('')).toBeNull();
  });

  it('returns the suspended tenant so the caller can tell suspension from a bad domain', async () => {
    const service = new TenantResolverService(fakeDb());
    const tenant = await service.resolveByHost('old.test');
    expect(tenant?.id).toBe('t3');
    expect(tenant?.isActive).toBe(false);
  });

  it('caches the host map and re-reads only after invalidate', async () => {
    const db = fakeDb();
    const service = new TenantResolverService(db);
    await service.resolveByHost('acme.test');
    await service.resolveByHost('globex.test');
    expect(db.find).toHaveBeenCalledTimes(1);
    service.invalidate();
    await service.resolveByHost('acme.test');
    expect(db.find).toHaveBeenCalledTimes(2);
  });

  it('matches case-insensitively', async () => {
    const service = new TenantResolverService(fakeDb());
    expect((await service.resolveByHost('ACME.test'))?.id).toBe('t1');
  });
});
