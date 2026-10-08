import { describe, it, expect } from 'vitest';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';

// The System group is drawn by hand at the foot of the sidebar, outside the list sortGroups returns.
// A plugin page filed under System (the Migration screen) used to vanish from the menu with it.
const items = [
  { label: 'Dashboard', path: '/', group: 'Core', pluginSlug: 'system' },
  { label: 'Activity', path: '/activity', group: 'Platform', pluginSlug: 'system' },
  { label: 'Settings', path: '/settings', group: 'System', pluginSlug: 'system' },
  { label: 'Migration', path: '/migrate', group: 'System', pluginSlug: 'migrate' },
  { label: 'Migration runs', path: '/migrate/runs', group: 'System', pluginSlug: 'migrate' },
  { label: 'Orders', path: '/shop/orders', group: 'Shop', pluginSlug: 'shop' },
];

describe('SidebarMenuService.systemPluginItems', () => {
  it('keeps the pages plugins filed under System, which the group list leaves out', () => {
    const { groupedMenu } = SidebarMenuService.buildGroupedMenu(items);
    expect(SidebarMenuService.sortGroups(groupedMenu)).not.toContain('system');
    expect(SidebarMenuService.systemPluginItems(groupedMenu, '/settings').map((item) => item.label)).toEqual(['Migration', 'Migration runs']);
  });

  it('leaves the framework\'s own Activity and Settings to the section that already draws them', () => {
    const { groupedMenu } = SidebarMenuService.buildGroupedMenu(items.filter((item) => item.pluginSlug === 'system'));
    expect(SidebarMenuService.systemPluginItems(groupedMenu, '/settings')).toEqual([]);
  });
});
