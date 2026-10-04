import { describe, expect, it, vi } from 'vitest';
import { PluginTenantAccess, TenantThemeAccess } from '@fromcode119/core';
import { TenantPagesService } from '@api/services/tenants/tenant-pages-service';

/**
 * A theme seed writes products, menus, partner records and plugin settings over whatever exists. It is
 * a NEW site's initial content: "Rebuild pages" on a running site used to replay it and overwrite the
 * operator's edits. Rebuilding now only adds the default pages that are missing.
 */
describe('theme seed runs only for a new site', () => {
  function service() {
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
});
