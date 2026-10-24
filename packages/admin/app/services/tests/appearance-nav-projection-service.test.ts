import { describe, it, expect } from 'vitest';
import { AppearanceNavProjectionService } from '@/app/services/appearance-nav-projection-service';

// The shape the metadata endpoint hands a site member whose only role holds one plugin's screens: the
// framework entries arrive too, and only the permission rules decide that they are not this person's.
const menu = [
  { label: 'Dashboard', path: '/', pluginSlug: 'system', permission: 'system:view' },
  { label: 'Users', path: '/users', pluginSlug: 'system', permission: 'users:view' },
  { label: 'Plugins', path: '/plugins', pluginSlug: 'system' },
  { label: 'Media', path: '/media', pluginSlug: 'system' },
  { label: 'Settings', path: '/settings', pluginSlug: 'system' },
  { label: 'Connection', path: '/replies/connection', pluginSlug: 'replies', permission: 'replies:manage' },
  { label: 'Rules', path: '/replies/rules', pluginSlug: 'replies', permission: 'replies:manage' },
];
const panel: any = {
  itemsByContext: {
    'org.example:system': [
      { label: 'Users', path: '/users', requiredCapabilities: ['users:view'] },
      { label: 'Roles', path: '/users/roles', requiredCapabilities: ['roles:view'] },
      { label: 'General', path: '/settings/general', requiredRoles: ['admin'] },
      { label: 'Security', path: '/settings/security', requiredRoles: ['admin'] },
    ],
  },
  globalItems: [],
};
const paths = (items: Array<{ path: string }>) => items.map((item) => item.path);

describe('AppearanceNavProjectionService.authorized', () => {
  it('gives a one-plugin member only that plugin\'s screens, in the menu and the panel', () => {
    const nav = AppearanceNavProjectionService.authorized(menu, panel, { roles: ['replies-reviewer'], permissions: ['replies:manage'] }, '/replies/rules');
    expect(paths(nav.items)).toEqual(['/replies/connection', '/replies/rules']);
    expect(nav.panelItems).toEqual([]);
    expect(nav.activePath).toBe('/replies/rules');
  });

  it('gives an admin every entry', () => {
    const nav = AppearanceNavProjectionService.authorized(menu, panel, { roles: ['admin'], permissions: ['*'] }, '/');
    expect(paths(nav.items)).toEqual(paths(menu));
    expect(paths(nav.panelItems ?? [])).toEqual(['/users', '/users/roles', '/settings/general', '/settings/security']);
  });

  it('keeps a panel entry whose capability the member holds', () => {
    const nav = AppearanceNavProjectionService.authorized(menu, panel, { roles: ['hr'], permissions: ['users:view'] }, '/users');
    expect(paths(nav.items)).toEqual(['/users']);
    expect(paths(nav.panelItems ?? [])).toEqual(['/users']);
  });

  it('shows nothing when no one is signed in yet', () => {
    const nav = AppearanceNavProjectionService.authorized(menu, panel, null, '/');
    expect(nav.items).toEqual([]);
    expect(nav.panelItems).toEqual([]);
  });
});
