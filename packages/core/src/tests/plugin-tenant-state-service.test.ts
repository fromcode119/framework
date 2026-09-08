import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { PluginTenantStateService } from '@core/plugin/tenant/plugin-tenant-state-service';

function fakeDb(rows: Array<Record<string, unknown>> = []) {
  return {
    rows,
    find: vi.fn(async () => rows),
    findOne: vi.fn(async (_table: string, where: any) => rows.find(
      (row) => row.tenant_id === where.tenant_id && row.plugin_slug === where.plugin_slug,
    ) ?? null),
    insert: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => true),
    execute: vi.fn(async () => ({})),
  } as any;
}

afterEach(() => PluginTenantAccess.reset());

describe('PluginTenantStateService', () => {
  it('inserts an enablement row for a tenant that has none', async () => {
    const db = fakeDb();
    await new PluginTenantStateService(db).enable('t1', 'eta');
    expect(db.insert).toHaveBeenCalledWith('_system_tenant_plugins', expect.objectContaining({
      tenant_id: 't1', plugin_slug: 'eta', state: 'active',
    }));
  });

  it('updates in place rather than inserting a second row', async () => {
    const db = fakeDb([{ tenant_id: 't1', plugin_slug: 'eta', state: 'inactive' }]);
    await new PluginTenantStateService(db).enable('t1', 'eta');
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledWith(
      '_system_tenant_plugins',
      { tenant_id: 't1', plugin_slug: 'eta' },
      expect.objectContaining({ state: 'active' }),
    );
  });

  it('DISABLING DELETES NOTHING — the tenant keeps its data and gets it back on re-enable', async () => {
    // Disabling must never be a destructive action behind an innocuous toggle. A plugin's tables are
    // platform-wide schema and its rows are tenant-scoped; erasing a tenant's data is T4, where it
    // is named as what it is.
    const db = fakeDb([{ tenant_id: 't1', plugin_slug: 'eta', state: 'active' }]);
    await new PluginTenantStateService(db).disable('t1', 'eta');
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledWith(
      '_system_tenant_plugins',
      { tenant_id: 't1', plugin_slug: 'eta' },
      expect.objectContaining({ state: 'inactive' }),
    );
  });

  it('invalidates the gate cache on every write — this IS the no-restart mechanism', async () => {
    const spy = vi.spyOn(PluginTenantAccess, 'invalidate');
    const db = fakeDb();
    await new PluginTenantStateService(db).enable('t1', 'eta');
    expect(spy).toHaveBeenCalledWith('t1');

    spy.mockClear();
    await new PluginTenantStateService(fakeDb([{ tenant_id: 't1', plugin_slug: 'eta', state: 'active' }]))
      .disable('t1', 'eta');
    expect(spy).toHaveBeenCalledWith('t1');
    spy.mockRestore();
  });

  it('never writes the PLATFORM plugin table — installation is not a tenant decision', async () => {
    const db = fakeDb();
    await new PluginTenantStateService(db).enable('t1', 'eta');
    for (const call of [...db.insert.mock.calls, ...db.update.mock.calls]) {
      expect(call[0]).toBe('_system_tenant_plugins');
    }
  });

  it('refuses a missing tenant or slug instead of writing a half-addressed row', async () => {
    const service = new PluginTenantStateService(fakeDb());
    await expect(service.enable('', 'eta')).rejects.toThrow(/required/i);
    await expect(service.enable('t1', '   ')).rejects.toThrow(/required/i);
  });

  it('lists only ACTIVE rows', async () => {
    const db = fakeDb([
      { tenant_id: 't1', plugin_slug: 'eta', state: 'active' },
      { tenant_id: 't1', plugin_slug: 'theta', state: 'inactive' },
    ]);
    expect(await new PluginTenantStateService(db).listEnabled('t1')).toEqual(['eta']);
  });
});
