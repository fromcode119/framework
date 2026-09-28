import { describe, it, expect } from 'vitest';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';

// The metadata names a permission on every item a non-admin can be given; one that names none is
// administrators' only.
const items = [
  { label: 'Dashboard', path: '/', pluginSlug: 'system', permission: 'system:view' },
  { label: 'Settings', path: '/settings', pluginSlug: 'system' },
  { label: 'Jobs', path: '/shop/jobs', pluginSlug: 'shop', permission: 'shop:manage' },
  { label: 'My work', path: '/shop/me', pluginSlug: 'shop', permission: 'shop:own' },
  { label: 'Orders', path: '/shop/orders', pluginSlug: 'shop', permission: 'shop:orders:read' },
];
const labels = (user: any) => SidebarMenuService.authorizeMenuItems(items, user).map((item) => item.label);

describe('SidebarMenuService.authorizeMenuItems — per-item permission', () => {
  it('an admin sees every item', () => {
    expect(labels({ roles: ['admin'] })).toEqual(['Dashboard', 'Settings', 'Jobs', 'My work', 'Orders']);
  });

  it('an employee holding only the "own" permission sees only the item that asks for it', () => {
    expect(labels({ roles: ['shop-staff'], permissions: ['shop:own'] })).toEqual(['My work']);
  });

  it('reading a collection shows that collection\'s list and nothing else of the plugin', () => {
    expect(labels({ roles: ['clerk'], permissions: ['shop:orders:read'] })).toEqual(['Orders']);
  });

  it('a plugin wildcard covers every item of that plugin, and no framework item', () => {
    expect(labels({ roles: ['manager'], permissions: ['shop:*'] })).toEqual(['Jobs', 'My work', 'Orders']);
  });

  it('a framework item needs its own permission; one that names none stays administrators\' only', () => {
    expect(labels({ roles: ['viewer'], permissions: ['system:*'] })).toEqual(['Dashboard']);
  });

  it('no permissions → nothing', () => {
    expect(labels({ roles: ['customer'], permissions: [] })).toEqual([]);
  });

  it('filters the children of a plugin dropdown group, and drops a group left empty', () => {
    const grouped = [
      { label: 'Shop', path: '/shop/me', pluginSlug: 'shop', isGroup: true, children: [
        { label: 'My work', path: '/shop/me', pluginSlug: 'shop', permission: 'shop:own' },
        { label: 'Jobs', path: '/shop/jobs', pluginSlug: 'shop', permission: 'shop:manage' },
      ] },
      { label: 'Other', path: '/other/a', pluginSlug: 'other', isGroup: true, children: [
        { label: 'A', path: '/other/a', pluginSlug: 'other', permission: 'other:manage' },
      ] },
    ];
    const menu = SidebarMenuService.authorizeMenuItems(grouped, { roles: ['shop-staff'], permissions: ['shop:own'] });
    expect(menu.map((item) => [item.label, item.children.map((child: any) => child.label)])).toEqual([['Shop', ['My work']]]);
  });

  it('sends a scoped user home to the first screen their menu offers', () => {
    const grouped = [
      { label: 'Shop', path: '/shop/jobs', pluginSlug: 'shop', isGroup: true, children: [
        { label: 'Jobs', path: '/shop/jobs', pluginSlug: 'shop', permission: 'shop:manage' },
        { label: 'My work', path: '/shop/me', pluginSlug: 'shop', permission: 'shop:own' },
      ] },
    ];
    expect(SidebarMenuService.homePathFor(grouped, { roles: ['shop-staff'], permissions: ['shop:own'] })).toBe('/shop/me');
    expect(SidebarMenuService.homePathFor(grouped, { roles: ['customer'], permissions: [] })).toBe('');
  });
});
