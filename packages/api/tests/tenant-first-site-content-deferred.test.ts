import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess, TenantMode, TenantThemeAccess } from '@fromcode119/core';
import { TenantPagesService } from '@api/services/tenants/tenant-pages-service';
import { PendingSiteSeed } from '@api/services/tenants/pending-site-seed';

/**
 * The first site is created while sites are not yet on, so nothing it seeds can belong to it: the rows
 * get no owner and row-level security hides them once the api restarts. Its content is recorded as owed
 * and created by the boot that turns sites on.
 */
describe('the first site defers its content to the next boot', () => {
  afterEach(() => { TenantMode.reset(); vi.restoreAllMocks(); });

  function pages() {
    vi.spyOn(PluginTenantAccess, 'invalidate').mockImplementation(() => undefined as any);
    vi.spyOn(TenantThemeAccess, 'invalidate').mockImplementation(() => undefined as any);
    vi.spyOn(PluginTenantAccess, 'warm').mockResolvedValue(undefined as any);
    vi.spyOn(TenantThemeAccess, 'warm').mockResolvedValue(undefined as any);
    vi.spyOn(TenantThemeAccess, 'choiceForAsync').mockResolvedValue({ activeSlug: 'shop-theme' } as any);
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = { queryRaw: vi.fn(async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return []; }) };
    const themeManager = { seedThemeForCurrentSite: vi.fn().mockResolvedValue({ seeded: true }) };
    const manager = {
      registeredCollections: [],
      db: { withTenant: async (_id: string, fn: () => any) => fn() },
      runPluginSeedsForCurrentSite: vi.fn().mockResolvedValue(undefined),
      materializeDefaultPages: vi.fn().mockResolvedValue(undefined),
    };
    const lookup = { requireTenant: vi.fn().mockResolvedValue({ id: 'site-a', isWorkspace: false }) };
    return { service: new TenantPagesService(db as any, manager as any, themeManager as any, lookup as any), db, queries, themeManager, manager };
  }

  it('writes nothing now and records the debt on the site', async () => {
    const { service, queries, themeManager, manager } = pages();
    const result = await service.materializePages('site-a', { seedTheme: true });
    expect(themeManager.seedThemeForCurrentSite).not.toHaveBeenCalled();
    expect(manager.runPluginSeedsForCurrentSite).not.toHaveBeenCalled();
    expect(manager.materializeDefaultPages).not.toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('INSERT INTO');
    expect(queries[0].params).toContain('site-a');
    expect(result.themeSeeded).toBe(false);
    expect(result.themeSeedReason).toContain('deferred');
  });

  it('seeds inline when sites are already on', async () => {
    TenantMode.configure({ tenantCount: 1, dialect: 'postgres', isolationSupported: true });
    const { service, queries, themeManager } = pages();
    const result = await service.materializePages('site-a', { seedTheme: true });
    expect(themeManager.seedThemeForCurrentSite).toHaveBeenCalledWith('shop-theme');
    expect(queries).toHaveLength(0);
    expect(result.themeSeeded).toBe(true);
  });

  it('a rebuild of a running install never records a debt', async () => {
    const { service, queries } = pages();
    await service.materializePages('site-a');
    expect(queries).toHaveLength(0);
  });
});

describe('PendingSiteSeed', () => {
  it('reads and clears a site\'s row inside that site\'s scope', async () => {
    const scopes: string[] = [];
    const calls: string[] = [];
    const db = {
      withTenant: vi.fn(async (id: string, fn: () => any) => { scopes.push(id); return fn(); }),
      queryRaw: vi.fn(async (sql: string) => { calls.push(sql); return sql.startsWith('SELECT') ? [{ '?column?': 1 }] : []; }),
    };
    const pending = new PendingSiteSeed(db as any);
    expect(await pending.isOwed('a')).toBe(true);
    await pending.clear('a');
    expect(scopes).toEqual(['a', 'a']);
    expect(calls[1]).toContain('DELETE FROM');
  });

  it('is not owed when the site has no row', async () => {
    const db = { withTenant: async (_id: string, fn: () => any) => fn(), queryRaw: vi.fn(async () => []) };
    expect(await new PendingSiteSeed(db as any).isOwed('a')).toBe(false);
  });
});
