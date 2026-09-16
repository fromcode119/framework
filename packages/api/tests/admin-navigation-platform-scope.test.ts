import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminNavigationScopeFilter } from '@api/services/system/admin-navigation-scope-filter';

/**
 * What an operator is handed once they step INTO a site.
 *
 * Three flags, three different questions, and the middle one was missing:
 *
 *   `platformOnly`      WHO is asking — a tenant's own administrator never sees these.
 *   `platformScopeOnly` WHERE they are standing — belongs to the platform, withheld inside a site.
 *   `siteOnly`          WHERE they are standing — needs a site, withheld when none is selected.
 *
 * Without the middle one, a platform administrator who switched into a site kept the platform's own
 * screens: that site's people and media, beside the registry of every site on the installation and
 * every repository it builds. Switching into a site is meant to make the console that site's.
 *
 * These screens have no tenant column, so there is nothing to scope — withholding them is the only
 * honest answer, and the path is reported so the console can say "switch to Platform" rather than
 * rendering a page that quietly describes somebody else's world.
 */
const MENU = [
  { label: 'Dashboard', path: '/' },
  { label: 'Sites', path: '/sites', platformOnly: true, platformScopeOnly: true },
  { label: 'Sources', path: '/sources', platformOnly: true, platformScopeOnly: true },
  { label: 'Orders', path: '/orders', siteOnly: true },
];

const labels = (menu: unknown[]) => menu.map((item: any) => item.label);

const onSite = (yes: boolean) => vi.spyOn(AdminNavigationScopeFilter, 'hasSite').mockReturnValue(yes);

afterEach(() => vi.restoreAllMocks());

describe('admin navigation by scope', () => {
  it('withholds the platform’s own screens inside a site', () => {
    onSite(true);

    const result = AdminNavigationScopeFilter.apply(MENU, true);

    expect(labels(result.menu)).toEqual(['Dashboard', 'Orders']);
  });

  it('reports those paths separately, because the advice is the opposite one', () => {
    onSite(true);

    const result = AdminNavigationScopeFilter.apply(MENU, true);

    expect(result.platformPaths).toEqual(['/sites', '/sources']);
    expect(result.removedPaths).toEqual([]);
  });

  it('offers them again in platform scope', () => {
    onSite(false);

    const result = AdminNavigationScopeFilter.apply(MENU, true);

    expect(labels(result.menu)).toEqual(['Dashboard', 'Sites', 'Sources']);
  });

  it('still withholds site screens when no site is selected', () => {
    onSite(false);

    const result = AdminNavigationScopeFilter.apply(MENU, true);

    expect(result.removedPaths).toEqual(['/orders']);
    expect(result.platformPaths).toEqual([]);
  });

  it('never offers platform screens to a tenant’s own administrator, in either scope', () => {
    // `platformOnly` is the other axis and still decides this one.
    onSite(false);
    expect(labels(AdminNavigationScopeFilter.apply(MENU, false).menu)).not.toContain('Sources');

    onSite(true);
    expect(labels(AdminNavigationScopeFilter.apply(MENU, true).menu)).not.toContain('Sources');
  });

  it('applies the same rule to the secondary panel', () => {
    onSite(true);

    const result = AdminNavigationScopeFilter.applyToPanel({ management: MENU }, true);

    expect(labels((result.panel as any).management)).toEqual(['Dashboard', 'Orders']);
    expect(result.platformPaths).toEqual(['/sites', '/sources']);
  });

  /**
   * The panel the admin actually receives keys its entries by the plugin that contributed them, so
   * the entries sit one level DOWN, under `itemsByContext`. The filter walked only the top level and
   * copied any non-array through whole — so the one object holding every settings entry was the one
   * thing never filtered, and both flags were dead there.
   */
  it('reaches the entries nested under itemsByContext', () => {
    onSite(true);

    const result = AdminNavigationScopeFilter.applyToPanel(
      { version: 3, itemsByContext: { 'org.fromcode:system': MENU } },
      true,
    );

    const items = (result.panel as any).itemsByContext['org.fromcode:system'];
    expect(labels(items)).toEqual(['Dashboard', 'Orders']);
    expect(result.platformPaths).toEqual(['/sites', '/sources']);
  });

  it('withholds nested site entries in the platform scope too', () => {
    onSite(false);

    const result = AdminNavigationScopeFilter.applyToPanel(
      { itemsByContext: { 'org.fromcode:system': MENU } },
      true,
    );

    const items = (result.panel as any).itemsByContext['org.fromcode:system'];
    expect(labels(items)).toEqual(['Dashboard', 'Sites', 'Sources']);
    expect(result.removedPaths).toEqual(['/orders']);
  });

  it('leaves everything that is not a menu array exactly as it was', () => {
    onSite(true);

    const panel = { version: 3, policy: { mode: 'merge' }, precedence: ['a', 'b'] };
    const result = AdminNavigationScopeFilter.applyToPanel(panel, true) as any;

    expect(result.panel.version).toBe(3);
    expect(result.panel.policy).toEqual({ mode: 'merge' });
    expect(result.panel.precedence).toEqual(['a', 'b']);
  });
});
