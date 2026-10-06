import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess, TenantMode, TenantThemeAccess } from '@fromcode119/core';
import { TenantPagesService } from '@api/services/tenants/tenant-pages-service';

/**
 * A theme seed writes products, menus, partner records and plugin settings over whatever exists. It is
 * a NEW site's initial content: "Rebuild pages" on a running site used to replay it and overwrite the
 * operator's edits. Rebuilding now only adds the default pages that are missing.
 */
describe('theme seed runs only for a new site', () => {
  afterEach(() => { TenantMode.reset(); vi.restoreAllMocks(); });

  function service() {
    // A running multi-site install: the first-site deferral has its own test.
    TenantMode.configure({ tenantCount: 1, dialect: 'postgres', isolationSupported: true });
    vi.spyOn(PluginTenantAccess, 'invalidate').mockImplementation(() => undefined as any);
    vi.spyOn(TenantThemeAccess, 'invalidate').mockImplementation(() => undefined as any);
    vi.spyOn(PluginTenantAccess, 'warm').mockResolvedValue(undefined as any);
    vi.spyOn(TenantThemeAccess, 'warm').mockResolvedValue(undefined as any);
    vi.spyOn(TenantThemeAccess, 'choiceForAsync').mockResolvedValue({ activeSlug: 'shop-theme' } as any);
    const themeManager = { seedThemeForCurrentSite: vi.fn().mockResolvedValue({ seeded: true }) };
    const manager = {
      registeredCollections: [],
      db: { withTenant: async (_id: string, fn: () => any) => fn() },
      runPluginSeedsForCurrentSite: vi.fn().mockResolvedValue(undefined),
      materializeDefaultPages: vi.fn().mockResolvedValue(undefined),
    };
    const lookup = { requireTenant: vi.fn().mockResolvedValue({ id: 'site-a', isWorkspace: false }) };
    return { pages: new TenantPagesService({} as any, manager as any, themeManager as any, lookup as any), themeManager, manager };
  }

  it('a rebuild adds missing default pages and leaves the theme seed alone', async () => {
    const { pages, themeManager, manager } = service();
    const result = await pages.materializePages('site-a');
    expect(themeManager.seedThemeForCurrentSite).not.toHaveBeenCalled();
    expect(manager.materializeDefaultPages).toHaveBeenCalled();
    expect(result.themeSeeded).toBe(false);
  });

  it('a new site gets the theme seed', async () => {
    const { pages, themeManager } = service();
    const result = await pages.materializePages('site-a', { seedTheme: true });
    expect(themeManager.seedThemeForCurrentSite).toHaveBeenCalledWith('shop-theme');
    expect(result.themeSeeded).toBe(true);
  });

  it('says why a rebuild did not seed instead of a bare false', async () => {
    const { pages } = service();
    const result = await pages.materializePages('site-a');
    expect(result.themeSeeded).toBe(false);
    expect(result.themeSeedReason).toContain('not requested');
    expect(result.warnings).toEqual([]);
  });

  it('names the reason when the theme declares no seeds', async () => {
    const { pages, themeManager } = service();
    themeManager.seedThemeForCurrentSite.mockResolvedValue({ seeded: false, reason: 'theme declares no seeds' });
    const result = await pages.materializePages('site-a', { seedTheme: true });
    expect(result.themeSeeded).toBe(false);
    expect(result.themeSeedReason).toBe('theme declares no seeds');
  });

  it('reports a failed seed as a reason and a warning, and still materializes the default pages', async () => {
    const { pages, themeManager, manager } = service();
    themeManager.seedThemeForCurrentSite.mockRejectedValue(new Error('Missing required plugin: cms'));
    const result = await pages.materializePages('site-a', { seedTheme: true });
    expect(result.themeSeeded).toBe(false);
    expect(result.themeSeedReason).toBe('seed failed: Missing required plugin: cms');
    expect(result.warnings).toEqual(['Theme "shop-theme" seed failed: Missing required plugin: cms']);
    expect(manager.materializeDefaultPages).toHaveBeenCalled();
  });

  it('says so when the site has no active theme', async () => {
    const { pages, themeManager } = service();
    vi.spyOn(TenantThemeAccess, 'choiceForAsync').mockResolvedValue({ activeSlug: '' } as any);
    const result = await pages.materializePages('site-a', { seedTheme: true });
    expect(themeManager.seedThemeForCurrentSite).not.toHaveBeenCalled();
    expect(result.themeSeedReason).toBe('the site has no active theme');
  });
});
