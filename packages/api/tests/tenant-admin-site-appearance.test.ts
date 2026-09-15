import { AppearanceManager, SystemConstants, TenantMode } from '@fromcode119/core';
import { TenantAdminService } from '@api/services/tenants/tenant-admin-service';

/**
 * Assigning a SITE its appearance, from platform scope.
 *
 * This exists because the isolation it accompanies would otherwise be a one-way door: a
 * tenant-bound request is shown only the appearance it already wears, so if the operator could not
 * set one from the site's own record, no site could ever be moved to a different console again.
 *
 * A site's appearance is NOT a column on the tenant row — `TenantIdentity.appearanceFor` throws for
 * a site, because that column is the workspace's kind lock. It is the per-site `admin_appearance`
 * setting, which is what these tests pin.
 */

const KEY = SystemConstants.META_KEY.ADMIN_APPEARANCE;

function buildService(kind: { isWorkspace: boolean }) {
  const meta = new Map<string, string>();
  const tenantScopes: string[] = [];
  const tenant: any = { id: 'site-a', slug: 'site-a', ...kind };

  const db: any = {
    withTenant: vi.fn(async (tenantId: string, fn: () => Promise<unknown>) => { tenantScopes.push(tenantId); return fn(); }),
    findOne: vi.fn(async (_table: string, where: any) => (meta.has(where.key) ? { key: where.key, value: meta.get(where.key) } : null)),
    update: vi.fn(async (_table: string, where: any, patch: any) => { meta.set(where.key, patch.value); return true; }),
    insert: vi.fn(async (_table: string, row: any) => { meta.set(row.key, row.value); return true; }),
    find: vi.fn(async () => []),
    dialect: 'postgres',
  };
  const manager: any = { db, schemaDb: db, registeredCollections: new Map(), getPlugins: () => [], hooks: { on: vi.fn(), emit: vi.fn() } };
  const service = new TenantAdminService(manager, { getThemes: () => [] } as any, '/tmp/uploads-under-test');

  // The collaborators this test is not about: the registry read/write and the audit trail.
  (service as any).requireTenant = vi.fn(async () => tenant);
  (service as any).registry = { update: vi.fn(async (_id: string, row: any) => ({ ...tenant, ...row })) };
  (service as any).record = vi.fn();
  (service as any).gateway = { notify: vi.fn() };
  (service as any).summarize = (value: any) => value;

  vi.spyOn(AppearanceManager.prototype, 'list').mockReturnValue([
    { slug: 'default', name: 'Default', version: '', builtIn: true },
    { slug: 'aurora', name: 'Aurora', version: '1.0.0', builtIn: false },
  ] as any);

  return { service, meta, db, tenantScopes };
}

afterEach(() => { TenantMode.reset(); vi.restoreAllMocks(); });

describe("assigning a site's appearance from platform scope", () => {
  it("writes the per-site `admin_appearance` setting rather than the tenant row", async () => {
    const { service, meta, db } = buildService({ isWorkspace: false });

    await service.update('site-a', { appearance: 'aurora' }, { id: 'operator' });

    expect(meta.get(KEY)).toBe('aurora');
    expect(db.insert).toHaveBeenCalledWith(SystemConstants.TABLE.META, expect.objectContaining({ key: KEY, value: 'aurora' }));
    // The row the registry was handed must NOT carry it: core refuses to store one for a site.
    expect(Object.keys((service as any).registry.update.mock.calls[0][1])).not.toContain('appearance');
  });

  it('UPDATES the setting when the site already has one, rather than inserting a second row', async () => {
    const { service, meta, db } = buildService({ isWorkspace: false });
    meta.set(KEY, 'aurora');

    await service.update('site-a', { appearance: 'default' }, { id: 'operator' });

    expect(meta.get(KEY)).toBe('');
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('writes INSIDE `withTenant`, or the owner connection restyles the platform console instead', async () => {
    const { service, tenantScopes } = buildService({ isWorkspace: false });

    await service.update('site-a', { appearance: 'aurora' }, { id: 'operator' });

    // The owner is a superuser and bypasses row-level security, so an unscoped write would land on
    // whichever `_system_meta` row it sees — the platform's.
    expect(tenantScopes).toEqual(['site-a']);
  });

  it("stores the built-in console as '', which is what the setting means by default", async () => {
    const { service, meta } = buildService({ isWorkspace: false });

    await service.update('site-a', { appearance: 'default' }, { id: 'operator' });

    expect(meta.get(KEY)).toBe('');
  });

  it('refuses an appearance that is not installed on this platform', async () => {
    const { service } = buildService({ isWorkspace: false });

    await expect(service.update('site-a', { appearance: 'ghost' }, { id: 'operator' }))
      .rejects.toThrow(/not installed/i);
  });

  it('leaves a patch that does not mention appearance completely alone', async () => {
    const { service, meta, db } = buildService({ isWorkspace: false });

    await service.update('site-a', { name: 'Renamed' }, { id: 'operator' });

    expect(meta.has(KEY)).toBe(false);
    expect(db.withTenant).not.toHaveBeenCalled();
  });

  it("does not touch the setting for a WORKSPACE — its appearance stays the tenant row its kind locks", async () => {
    const { service, meta } = buildService({ isWorkspace: true });

    await service.update('ws-a', { appearance: 'aurora' }, { id: 'operator' });

    expect(meta.has(KEY)).toBe(false);
    expect((service as any).registry.update.mock.calls[0][1]).toMatchObject({ appearance: 'aurora' });
  });
});
