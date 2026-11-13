import { describe, expect, it } from 'vitest';
import { SidebarMenuService } from '@/app/services/sidebar-menu-service';

describe('SidebarMenuService.sections', () => {
  const grouped = {
    core: [
      { label: 'Dashboard', path: '/', pluginSlug: 'system', group: 'Core' },
      { label: 'Media', path: '/media', pluginSlug: 'system', group: 'Core' },
      { label: 'Settings', path: '/settings', pluginSlug: 'system', group: 'Core' },
    ],
    commerce: [
      { label: 'Orders', path: '/shop/orders', pluginSlug: 'shop', priority: 1 },
      { label: 'Carrier', path: '/carrier', pluginSlug: 'carrier', priority: 2 },
      { label: 'Products', path: '/shop/products', pluginSlug: 'shop', priority: 3 },
    ],
    platform: [{ label: 'Users', path: '/users', pluginSlug: 'system' }],
  };

  it('puts the dashboard first, media last, and the upkeep groups under Settings', () => {
    const { main, settingsArea } = SidebarMenuService.sections(grouped, '/settings');
    expect(main[0].label).toBe('Dashboard');
    expect(main[main.length - 1].label).toBe('Media');
    expect(settingsArea.map((item) => item.label)).toEqual(['Users']);
    expect([...main, ...settingsArea].some((item) => item.path === '/settings')).toBe(false);
  });

  it('keeps one plugin\'s sections together inside a shared group', () => {
    const { main } = SidebarMenuService.sections(grouped, '/settings');
    expect(main.map((item) => item.label)).toEqual(['Dashboard', 'Orders', 'Products', 'Carrier', 'Media']);
  });
});
