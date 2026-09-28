import { describe, it, expect } from 'vitest';
import { AdminPageAccessService } from '@/app/services/admin-page-access-service';

const menu = [
  { label: 'Dashboard', path: '/', pluginSlug: 'system', permission: 'system:view' },
  { label: 'Shop', path: '/shop/me', pluginSlug: 'shop', isGroup: true, children: [
    { label: 'Overview', path: '/shop', pluginSlug: 'shop', permission: 'shop:manage' },
    { label: 'My work', path: '/shop/me', pluginSlug: 'shop', permission: 'shop:own' },
    { label: 'Orders', path: '/shop/orders', pluginSlug: 'shop', permission: 'shop:orders:read' },
  ] },
];
const staff = { id: 4, roles: ['shop-staff'], permissions: ['shop:own'] };
const allowed = (path: string, user: any) => AdminPageAccessService.isAllowed(path, menu, user);

describe('AdminPageAccessService', () => {
  it('refuses a framework page to a role that lacks its permission — the bookmarked "Create role" form', () => {
    expect(allowed('/users/roles/new', staff)).toBe(false);
    expect(AdminPageAccessService.requiredFor('/users/roles/new', menu, staff)).toBe('roles:manage');
  });

  it('opens role and user screens by the permission their API checks', () => {
    const viewer = { id: 9, roles: ['r'], permissions: ['roles:view', 'users:view'] };
    expect(allowed('/users/roles', viewer)).toBe(true);
    expect(allowed('/users/permissions', viewer)).toBe(true);
    expect(allowed('/users/roles/new', viewer)).toBe(false);
    expect(allowed('/users/roles/editor/edit', viewer)).toBe(false);
    expect(allowed('/users', viewer)).toBe(true);
    expect(allowed('/users/12', viewer)).toBe(true);
    expect(allowed('/users/12/edit', viewer)).toBe(false);
    expect(allowed('/users/people/3', viewer)).toBe(true);
  });

  it('keeps every other framework page for administrators', () => {
    expect(AdminPageAccessService.requiredFor('/settings/general', menu, staff)).toBe('*');
    expect(allowed('/plugins', { roles: ['x'], permissions: ['system:manage'] })).toBe(false);
    expect(allowed('/settings/general', { roles: ['admin'], permissions: [] })).toBe(true);
  });

  it('lets anyone open their own profile and the dashboard (which redirects them itself)', () => {
    expect(allowed('/users/4', staff)).toBe(true);
    expect(allowed('/users/4/security', staff)).toBe(true);
    expect(allowed('/users/5', staff)).toBe(false);
    expect(allowed('/', staff)).toBe(true);
  });

  it('a plugin page needs its menu item\'s permission, and a record page inherits its list\'s', () => {
    expect(allowed('/shop/me', staff)).toBe(true);
    expect(allowed('/shop', staff)).toBe(false);
    expect(allowed('/shop/orders/77', { roles: ['c'], permissions: ['shop:orders:read'] })).toBe(true);
    expect(allowed('/shop/orders/77', staff)).toBe(false);
    expect(AdminPageAccessService.requiredFor('/shop/unlisted', menu, staff)).toBe('shop:manage');
  });
});
