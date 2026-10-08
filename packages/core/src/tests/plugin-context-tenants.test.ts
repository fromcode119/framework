import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { TenantsContextProxy } from '@core/plugin/context/tenants';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

/**
 * A plugin's `onInit` runs at boot, where there is no site. Every tenant-scoped query made there was
 * skipped or refused, so one-off work — a backfill, a default row — silently happened for NO site,
 * and there was no way to ask for anything else: the plugin context had no tenancy surface at all.
 */
describe('context.tenants', () => {
  let db: any;
  const tenants = (ids: string[]): void => {
    vi.spyOn(TenantResolverService, 'shared').mockReturnValue({
      listActive: async () => ids.map((id) => ({ id, isActive: true })),
    } as any);
  };
  const proxy = () => TenantsContextProxy.createTenantsProxy({ db } as any, 'guestbook');
  /** The sites that have this plugin switched on. */
  const enabledOn = (ids: string[]): void => {
    vi.spyOn(PluginTenantAccess, 'isPresentFor').mockImplementation(async (_slug, tenantId) => ids.includes(tenantId));
  };

  beforeEach(() => { db = { withTenant: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()) }; });
  afterEach(() => { vi.restoreAllMocks(); TenantMode.reset?.(); });

  it('runs a plugin\'s work once per site, and says how many', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    tenants(['a', 'b', 'c']);
    enabledOn(['a', 'b', 'c']);
    const seen: Array<string | undefined> = [];

    const count = await proxy().forEach(async () => { seen.push(RequestContextUtils.getTenantId()); });

    expect(count).toBe(3);
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('skips every site that has NOT enabled the plugin — its data is not this plugin\'s to touch', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    tenants(['a', 'b', 'c']);
    enabledOn(['b']);
    const seen: Array<string | undefined> = [];

    const count = await proxy().forEach(async () => { seen.push(RequestContextUtils.getTenantId()); });

    expect(count).toBe(1);
    expect(seen).toEqual(['b']);
  });

  it('inside a request runs once, for that site only, never fanning out to the others', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    tenants(['a', 'b', 'c']);
    enabledOn(['a', 'b', 'c']);
    const seen: Array<string | undefined> = [];

    const count = await RequestContextUtils.storage.run({ tenantId: 'b' } as any, () =>
      proxy().forEach(async () => { seen.push(RequestContextUtils.getTenantId()); }));

    expect(count).toBe(1);
    expect(seen).toEqual(['b']);
  });

  it('inside a request on a site without the plugin, does nothing', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    enabledOn(['a']);
    const work = vi.fn(async () => undefined);

    const count = await RequestContextUtils.storage.run({ tenantId: 'b' } as any, () => proxy().forEach(work));

    expect(count).toBe(0);
    expect(work).not.toHaveBeenCalled();
  });

  it('runs once on a single-site deployment, unscoped', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(false);
    const work = vi.fn(async () => undefined);

    await expect(proxy().forEach(work)).resolves.toBe(1);
    expect(db.withTenant).not.toHaveBeenCalled();
  });

  it('names the current site inside a request, and null outside one', async () => {
    await expect(proxy().current()).resolves.toBeNull();

    await RequestContextUtils.storage.run({ tenantId: 'a' } as any, async () => {
      await expect(proxy().current()).resolves.toBe('a');
    });
  });

  it('reports whether the deployment serves more than one site', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    await expect(proxy().isMultiSite()).resolves.toBe(true);
  });
});
