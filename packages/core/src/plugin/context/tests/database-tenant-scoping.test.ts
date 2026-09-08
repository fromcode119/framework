import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '@core/plugin/context/database';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';

const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;

const security = {
  hasCapability: () => true,
  handleViolation: vi.fn(),
  handleRateLimit: vi.fn(),
} as any;

function buildManager() {
  return {
    db: {
      find: vi.fn(async () => []),
      findOne: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      groupCount: vi.fn(async () => []),
      insert: vi.fn(async (_table: string, data: any) => ({ ...data })),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => true),
      tableExists: vi.fn(async () => true),
      getColumns: vi.fn(async () => []),
    },
    audit: { logAction: vi.fn() },
    getCollection: () => ({ collection: { fields: [] } }),
  } as any;
}

function inTenant<T>(tenantId: string, fn: () => T): T {
  return RequestContextUtils.storage.run({ locale: 'en', tenantId }, fn);
}

describe('context.db tenant scoping', () => {
  // Tenant scoping only applies when the deployment actually has tenants; a single-tenant install
  // must behave exactly as it did before tenancy existed. See the last case in this file.
  beforeAll(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
  afterAll(() => TenantMode.reset());

  /**
   * A plugin's `onInit` runs outside any request, and several plugins ask whether their own table
   * exists before normalising it. That question returns no rows, so it cannot leak across tenants —
   * but the tenant injection used to demand a tenant for it anyway while the boot-access skip waved it
   * through as harmless. The two disagreeing killed gamma at boot with "No tenant in the request
   * context", and took delta-econt down with it as a dependant.
   */
  it('answers a shape question at boot, with no tenant, rather than failing the plugin', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await expect(db.tableExists('fcp_alpha_things')).resolves.toBe(true);
    await expect(db.getColumns('fcp_alpha_things')).resolves.toEqual([]);
    expect(manager.db.tableExists).toHaveBeenCalledWith('fcp_alpha_things');
  });

  it('still refuses an untenanted call that WOULD return rows', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    // Skipped-and-logged by UntenantedBootAccess rather than run unscoped: an empty result, never
    // every tenant's rows.
    await expect(db.find('fcp_alpha_things', {})).resolves.toEqual([]);
    expect(manager.db.find).not.toHaveBeenCalled();
  });

  it('ANDs the tenant into a find that has no where at all', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await inTenant('t1', () => db.find('fcp_alpha_things', { limit: 10 }));
    expect(manager.db.find).toHaveBeenCalledWith('fcp_alpha_things', { limit: 10, where: { tenantId: 't1' } });
  });

  it('adds the tenant when no options object is passed at all', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await inTenant('t1', () => db.find('fcp_alpha_things'));
    expect(manager.db.find).toHaveBeenCalledWith('fcp_alpha_things', { where: { tenantId: 't1' } });
  });

  it('preserves an existing where and adds the tenant beside it', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await inTenant('t1', () => db.find('fcp_alpha_things', { where: { status: 'open' }, limit: 5 }));
    expect(manager.db.find).toHaveBeenCalledWith(
      'fcp_alpha_things',
      { where: { status: 'open', tenantId: 't1' }, limit: 5 },
    );
  });

  it('adds the tenant to count, under where and not at the top level', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await inTenant('t2', () => db.count('fcp_alpha_things', { where: { status: 'x' } }));
    expect(manager.db.count).toHaveBeenCalledWith('fcp_alpha_things', { where: { status: 'x', tenantId: 't2' } });
  });

  it('adds the tenant to findOne, whose where is the SECOND ARG not an option', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await inTenant('t1', () => db.findOne('fcp_alpha_things', { id: 5 }));
    expect(manager.db.findOne).toHaveBeenCalledWith('fcp_alpha_things', { id: 5, tenantId: 't1' });
  });

  it('adds the tenant to update and delete filters', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await inTenant('t1', () => db.update('fcp_alpha_things', { id: 5 }, { title: 'x' }));
    expect(manager.db.update).toHaveBeenCalledWith('fcp_alpha_things', { id: 5, tenantId: 't1' }, { title: 'x' });

    await inTenant('t1', () => db.delete('fcp_alpha_things', { id: 5 }));
    expect(manager.db.delete).toHaveBeenCalledWith('fcp_alpha_things', { id: 5, tenantId: 't1' });
  });

  it('does NOT stamp insert — the column DEFAULT does it and WITH CHECK verifies it', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await inTenant('t1', () => db.insert('fcp_alpha_things', { title: 'x' }));
    expect(manager.db.insert).toHaveBeenCalledWith('fcp_alpha_things', { title: 'x' });
  });

  it('THROWS inside a request that has no tenant, rather than querying every tenant', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    // A request store WITHOUT a tenantId is a bug in the request path, not background work — so it
    // fails closed rather than being skipped. The skip path is the no-store case, tested below.
    await expect(RequestContextUtils.storage.run({ locale: 'en' }, async () => db.find('fcp_alpha_things', {})))
      .rejects.toThrow(/tenant/i);
    expect(manager.db.find).not.toHaveBeenCalled();
  });

  it('keeps the cross-plugin isolation guard — another plugin\'s table still throws', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    await expect(async () => inTenant('t1', () => db.find('fcp_beta_orders', {})))
      .rejects.toThrow(/Security Violation/);
  });

  it('injects NOTHING on a single-tenant deployment — pre-tenancy behaviour is unchanged', async () => {
    TenantMode.reset();
    try {
      const manager = buildManager();
      const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
      await db.find('fcp_alpha_things', { limit: 10 });
      expect(manager.db.find).toHaveBeenCalledWith('fcp_alpha_things', { limit: 10 });
    } finally {
      TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    }
  });

  it('SKIPS untenanted calls made outside any request, returning a promise', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(plugin, manager, security);
    // No RequestContextUtils.storage.run(...) — this is the boot / deferred-seed / scheduled-job path.
    const rows = await db.find('fcp_alpha_things', {}).catch(() => 'threw');
    expect(rows).toEqual([]);
    expect(manager.db.find).not.toHaveBeenCalled();
  });
});
