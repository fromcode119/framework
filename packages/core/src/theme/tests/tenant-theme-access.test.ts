import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';
import { TenantThemeStateService } from '@core/theme/tenant-theme-state-service';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';

/** Rows come back through the RAW manager, so snake_case — fixtures mirror that. */
function fakeDb(rowsByTenant: Record<string, Array<Record<string, unknown>>>, options: { fail?: boolean } = {}) {
  const store = rowsByTenant;
  return {
    find: vi.fn(async (_t: string, q: any) => {
      if (options.fail) throw new Error('connection lost');
      if (q?.where?.tenant_id) return store[String(q.where.tenant_id)] ?? [];
      if (q?.where?.theme_slug) return Object.entries(store).flatMap(([tid, rows]) => rows.filter((r) => r.theme_slug === q.where.theme_slug).map((r) => ({ ...r, tenant_id: tid })));
      return [];
    }),
    insert: vi.fn(async (_t: string, row: any) => { (store[row.tenant_id] ||= []).push({ ...row }); }),
    update: vi.fn(async (_t: string, where: any, patch: any) => { for (const r of store[where.tenant_id] ?? []) if (r.theme_slug === where.theme_slug) Object.assign(r, patch); }),
    delete: vi.fn(async (_t: string, where: any) => { store[where.tenant_id] = (store[where.tenant_id] ?? []).filter((r) => r.theme_slug !== where.theme_slug); }),
  } as any;
}
const multiTenant = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
afterEach(() => { TenantThemeAccess.reset(); TenantMode.reset(); });

describe('TenantThemeAccess', () => {
  it('answers null on a SINGLE-TENANT deployment, so the process-wide theme keeps deciding', () => {
    TenantThemeAccess.configure(fakeDb({}));
    expect(TenantThemeAccess.currentChoice()).toBeNull();
  });

  it('serves each tenant its own active theme and its own config', async () => {
    multiTenant();
    TenantThemeAccess.configure(fakeDb({
      t1: [{ theme_slug: 'aurora', state: 'active', config: { variables: { accent: 'red' } } }],
      t2: [{ theme_slug: 'basic', state: 'active', config: null }, { theme_slug: 'aurora', state: 'inactive' }],
    }));
    await TenantThemeAccess.warm('t1'); await TenantThemeAccess.warm('t2');
    RequestContextUtils.storage.run({ tenantId: 't1' } as any, () => {
      const c = TenantThemeAccess.currentChoice()!;
      expect(c.activeSlug).toBe('aurora'); expect(c.config).toEqual({ variables: { accent: 'red' } });
    });
    RequestContextUtils.storage.run({ tenantId: 't2' } as any, () => {
      const c = TenantThemeAccess.currentChoice()!;
      expect(c.activeSlug).toBe('basic'); expect(c.config).toBeNull();
    });
  });

  it('gives a tenant with no row NO theme — never another tenant\'s, never the platform\'s', async () => {
    multiTenant();
    TenantThemeAccess.configure(fakeDb({ t1: [{ theme_slug: 'aurora', state: 'active' }] }));
    await TenantThemeAccess.warm('t1'); await TenantThemeAccess.warm('t2');
    RequestContextUtils.storage.run({ tenantId: 't2' } as any, () => {
      expect(TenantThemeAccess.currentChoice()!.hasTheme).toBe(false);
    });
  });

  it('gives a request with NO tenant no theme on a multi-tenant deployment', async () => {
    multiTenant();
    TenantThemeAccess.configure(fakeDb({ t1: [{ theme_slug: 'aurora', state: 'active' }] }));
    await TenantThemeAccess.warm('t1');
    expect(TenantThemeAccess.currentChoice()!.hasTheme).toBe(false);
  });

  it('parses a config that arrives as a JSON STRING (SQLite) as well as an object (jsonb)', async () => {
    multiTenant();
    TenantThemeAccess.configure(fakeDb({ t1: [{ theme_slug: 'aurora', state: 'active', config: '{"variables":{"accent":"blue"}}' }] }));
    await TenantThemeAccess.warm('t1');
    expect(TenantThemeAccess.choiceFor('t1').config).toEqual({ variables: { accent: 'blue' } });
  });

  it('does not cache a failed read', async () => {
    multiTenant();
    TenantThemeAccess.configure(fakeDb({}, { fail: true }));
    await TenantThemeAccess.warm('t1');
    TenantThemeAccess.configure(fakeDb({ t1: [{ theme_slug: 'aurora', state: 'active' }] }));
    await TenantThemeAccess.warm('t1');
    expect(TenantThemeAccess.choiceFor('t1').activeSlug).toBe('aurora');
  });
});

describe('TenantThemeStateService', () => {
  it('activate retires the previous active row and invalidates — the next request sees the new theme', async () => {
    multiTenant();
    const db = fakeDb({ t1: [{ theme_slug: 'aurora', state: 'active' }] });
    TenantThemeAccess.configure(db);
    await TenantThemeAccess.warm('t1');
    expect(TenantThemeAccess.choiceFor('t1').activeSlug).toBe('aurora');

    await new TenantThemeStateService(db).activate('t1', 'basic');
    await TenantThemeAccess.warm('t1');
    const rows = await db.find('_system_tenant_themes', { where: { tenant_id: 't1' } });
    expect(rows.filter((r: any) => r.state === 'active').map((r: any) => r.theme_slug)).toEqual(['basic']);
    expect(TenantThemeAccess.choiceFor('t1').activeSlug).toBe('basic');
  });

  it('activating for t1 changes NOTHING for t2', async () => {
    multiTenant();
    const db = fakeDb({ t1: [], t2: [{ theme_slug: 'aurora', state: 'active' }] });
    TenantThemeAccess.configure(db);
    await new TenantThemeStateService(db).activate('t1', 'basic');
    await TenantThemeAccess.warm('t2');
    expect(TenantThemeAccess.choiceFor('t2').activeSlug).toBe('aurora');
  });

  it('never writes the PLATFORM themes table', async () => {
    const db = fakeDb({ t1: [] });
    await new TenantThemeStateService(db).activate('t1', 'basic');
    for (const call of [...db.insert.mock.calls, ...db.update.mock.calls]) expect(call[0]).toBe('_system_tenant_themes');
  });

  it('clearForTheme removes every tenant\'s row for a deleted theme and reports who is left bare', async () => {
    const db = fakeDb({ t1: [{ theme_slug: 'aurora', state: 'active' }], t2: [{ theme_slug: 'aurora', state: 'inactive' }, { theme_slug: 'basic', state: 'active' }] });
    const orphaned = await new TenantThemeStateService(db).clearForTheme('aurora');
    expect(orphaned).toEqual(['t1']);
    expect((await db.find('_system_tenant_themes', { where: { tenant_id: 't2' } })).map((r: any) => r.theme_slug)).toEqual(['basic']);
  });

  it('refuses a missing tenant or slug', async () => {
    const svc = new TenantThemeStateService(fakeDb({}));
    await expect(svc.activate('', 'x')).rejects.toThrow(/required/i);
    await expect(svc.activate('t1', ' ')).rejects.toThrow(/required/i);
  });
});
