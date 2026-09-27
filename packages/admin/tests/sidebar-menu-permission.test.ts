import { describe, it, expect } from 'vitest';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';

const items = [
  { label: 'Dashboard', path: '/' },
  { label: 'Jobs', path: '/shop/jobs', pluginSlug: 'shop', permission: 'shop:manage' },
  { label: 'My work', path: '/shop/me', pluginSlug: 'shop', permission: 'shop:own' },
  { label: 'Reports', path: '/shop/reports', pluginSlug: 'shop' },
];
const labels = (user: any) => SidebarMenuService.authorizeMenuItems(items, user).map((item) => item.label);

describe('SidebarMenuService.authorizeMenuItems — per-item permission', () => {
  it('an admin sees every item', () => {
    expect(labels({ roles: ['admin'] })).toEqual(['Dashboard', 'Jobs', 'My work', 'Reports']);
  });

  it('an employee holding only the "own" permission sees only the item that asks for it, plus undeclared items of that plugin', () => {
    expect(labels({ roles: ['shop-staff'], permissions: ['shop:own'] })).toEqual(['My work', 'Reports']);
  });

  it('a plugin wildcard covers every declared item', () => {
    expect(labels({ roles: ['manager'], permissions: ['shop:*'] })).toEqual(['Jobs', 'My work', 'Reports']);
  });

  it('no permissions → nothing', () => {
    expect(labels({ roles: ['customer'], permissions: [] })).toEqual([]);
  });
});
