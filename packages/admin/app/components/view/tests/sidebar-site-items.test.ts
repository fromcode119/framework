import { describe, expect, it } from 'vitest';
import { SidebarSiteItems } from '@/app/components/view/sidebar-site-items';
import { TenantOption } from '@/lib/tenants/tenant-option';

/**
 * The account menu's Sites group. On a console host bound to one site the server refuses every switch
 * and every step out (`workspace_host_locks_tenant`), so the menu must not offer them there.
 */
describe('SidebarSiteItems', () => {
  const tenants = TenantOption.fromList([
    { id: '1', slug: 'book', primaryHost: 'book.example.test' },
    { id: '2', slug: 'shop', primaryHost: 'shop.example.test' },
  ]);
  const build = (locked: boolean) => SidebarSiteItems.build({
    tenants, current: '1', mode: '', multiTenant: true, locked, storefrontHost: '',
    canManagePlatform: true, onSelect: () => undefined, onLeave: () => undefined, onAddSite: () => undefined,
  });

  it('offers the platform, every site and adding a site on the shared console', () => {
    expect(build(false).map((item) => item.label)).toEqual(['Platform', 'book', 'shop', 'Add a site']);
  });

  it('offers only the site the host is bound to on a locked console', () => {
    const items = build(true);
    expect(items.map((item) => [item.label, item.selected])).toEqual([['book', true]]);
    expect(items[0]!.section).toBe('Sites');
  });
});
