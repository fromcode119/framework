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

/**
 * WHO comes first inside an area is the platform's to say. Ordered by the first page's number — which
 * every plugin picks for itself, starting at 1 — an area opened with whichever plugin wrote the
 * smallest one, and the plugin that declares the area could sit last.
 */
describe('the order of plugins inside an area', () => {
  const build2 = (plugins: any[]) => new AdminMenuBuilderService(logger, new AdminSystemNavigationMetadataService())
    .build(plugins.map((manifest) => ({ manifest } as any)), plugins, new Map());

  const owner = { slug: 'writing', name: 'Writing', admin: { group: 'Content', label: 'Writing', areas: [{ key: 'content' }], menu: [{ label: 'Overview', path: '/writing', priority: 1 }, { label: 'Pages', path: '/writing/pages', priority: 2 }], slots: [{ slot: 'admin.plugin.writing.content' }] } };
  const early = { slug: 'alerts', name: 'Alerts', admin: { group: 'Content', label: 'Alerts', menu: [{ label: 'Connection', path: '/alerts/connection', priority: 0 }], slots: [{ slot: 'admin.plugin.alerts.content' }] } };
  const later = { slug: 'boards', name: 'Boards', admin: { group: 'Content', label: 'Boards', menu: [{ label: 'Boards', path: '/boards', priority: 0 }], slots: [{ slot: 'admin.plugin.boards.content' }] } };

  it('puts the plugin that declares the area first, whatever the others numbered themselves', () => {
    const area = build2([early, later, owner]).find((item) => item.isArea);
    expect(area.children[0].pluginSlug).toBe('writing');
  });

  it('orders the rest by their own names, not by a number they chose', () => {
    const area = build2([early, later, owner]).find((item) => item.isArea);
    const order: string[] = [];
    area.children.forEach((child: any) => { if (!order.includes(child.pluginSlug)) order.push(child.pluginSlug); });
    expect(order).toEqual(['writing', 'alerts', 'boards']);
  });
});

/**
 * A piece of WORK, not a plugin, is what the menu lists. An adapter files its pages into the work it
 * serves (`admin.block`), the plugin that owns that work declares it (`admin.blocks`), and nothing
 * names another plugin: the key is shared vocabulary, exactly as an area key is.
 */
describe('work declared across plugins', () => {
  const build3 = (plugins: any[]) => new AdminMenuBuilderService(logger, new AdminSystemNavigationMetadataService())
    .build(plugins.map((manifest) => ({ manifest } as any)), plugins, new Map());

  const parcels = { slug: 'parcels', name: 'Parcels', admin: { group: 'Commerce', label: 'Delivery', blocks: [{ key: 'delivery' }], menu: [{ label: 'Overview', path: '/parcels', priority: 1 }, { label: 'Methods', path: '/parcels/methods', priority: 2 }], slots: [{ slot: 'admin.plugin.parcels.content' }] } };
  const carrier = { slug: 'carrier', name: 'Carrier', admin: { group: 'Commerce', label: 'Carrier', block: 'delivery', menu: [{ label: 'Offices', path: '/carrier/offices' }], slots: [{ slot: 'admin.plugin.carrier.content' }] } };

  it('carries the work and its owner on every page that joined it', () => {
    const area = build3([carrier, parcels]).find((item) => item.isArea);
    const offices = area.children.find((child: any) => child.path === '/carrier/offices');
    expect(offices.blockKey).toBe('delivery');
    expect(offices.blockOwnerSlug).toBe('parcels');
    expect(offices.blockPath).toBe('/parcels');
  });

  it('reads the owner of the work before whoever joined it, whatever they numbered themselves', () => {
    const area = build3([carrier, parcels]).find((item) => item.isArea);
    expect(area.children.map((child: any) => child.path))
      .toEqual(['/parcels', '/parcels/methods', '/carrier/offices']);
  });
});
