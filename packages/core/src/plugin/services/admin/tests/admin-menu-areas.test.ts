import { describe, expect, it, vi } from 'vitest';
import { AdminMenuBuilderService } from '@core/plugin/services/admin/admin-menu-builder-service';
import { AdminSystemNavigationMetadataService } from '@core/plugin/services/admin/admin-system-navigation-metadata-service';

/**
 * The menu is filed by the AREA a plugin declares, not by the plugin. A courier plugin and the
 * logistics plugin both say `commerce`, so the operator finds the courier inside the work it belongs
 * to instead of as a row of its own beside it — which is what a console with 38 plugins turns into.
 */
const logger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } as any;

const build = (plugins: any[]) => new AdminMenuBuilderService(logger, new AdminSystemNavigationMetadataService())
  .build(plugins.map((manifest) => ({ manifest } as any)), plugins, new Map());

describe('admin menu areas', () => {
  const delivery = { slug: 'delivery', name: 'Delivery', admin: { group: 'Commerce', label: 'Delivery', menu: [{ label: 'Shipments', path: '/delivery/shipments' }, { label: 'Methods', path: '/delivery/methods' }], slots: [{ slot: 'admin.plugin.delivery.content' }] } };
  const courier = { slug: 'courier', name: 'Courier', admin: { group: 'Commerce', label: 'Courier', menu: [{ label: 'Waybills', path: '/courier/waybills' }], slots: [{ slot: 'admin.plugin.courier.content' }] } };
  const money = { slug: 'money', name: 'Money', admin: { group: 'Finance', label: 'Money', menu: [{ label: 'Payments', path: '/money/payments' }], slots: [{ slot: 'admin.plugin.money.content' }] } };

  it('files every plugin of one area under that area, not beside it', () => {
    const menu = build([delivery, courier]);
    const areas = menu.filter((item) => item.isGroup);
    expect(areas).toHaveLength(1);
    expect(areas[0].label).toBe('Commerce');
    expect(areas[0].children.map((child: any) => child.label).sort())
      .toEqual(['Methods', 'Shipments', 'Waybills']);
    // ...and nothing of theirs stands at the top level beside it.
    expect(menu.filter((item) => item.pluginSlug === 'courier' && !item.isGroup)).toHaveLength(0);
  });

  it('wears the mark the owning plugin declares for the area, never a plugin of its own', () => {
    const owner = { slug: 'owner', name: 'Owner', admin: { group: 'Commerce', label: 'Owner', icon: 'Boxes', areas: [{ key: 'commerce', icon: 'ShoppingBag' }], menu: [{ label: 'Hub', path: '/owner/hub' }], slots: [{ slot: 'admin.plugin.owner.content' }] } };
    const menu = build([delivery, courier, owner]);
    const area = menu.find((item) => item.isArea);
    expect(area.icon).toBe('ShoppingBag');
  });

  it('falls back to a neutral mark while nobody declares the area', () => {
    const menu = build([delivery, courier]);
    expect(menu.find((item) => item.isArea).icon).toBe('Layers');
  });

  it('an area holding one page is that page, with no chevron that opens a list of one', () => {
    const menu = build([money]);
    const own = menu.filter((item) => item.pluginSlug === 'money');
    expect(own).toHaveLength(1);
    expect(own[0].isGroup).toBeUndefined();
    expect(own[0].label).toBe('Payments');
  });

  it('keeps the console own entries as they are', () => {
    const menu = build([delivery, courier]);
    const system = menu.filter((item) => item.pluginSlug === 'system').map((item) => item.label);
    expect(system).toContain('Dashboard');
    expect(system).toContain('Settings');
    expect(menu.find((item) => item.label === 'Dashboard')?.isGroup).toBeUndefined();
  });
});
