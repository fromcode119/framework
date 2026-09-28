import { describe, expect, it, vi } from 'vitest';
import { AdminMenuBuilderService } from '@core/plugin/services/admin/admin-menu-builder-service';
import { AdminSystemNavigationMetadataService } from '@core/plugin/services/admin/admin-system-navigation-metadata-service';
import { ApiAccessGate } from '@core/plugin/context/api-access-gate';

/**
 * Every menu item a non-admin can be given names the permission that opens it — the same name the API
 * checks — so the sidebar, a bookmarked URL and the API answer from one rule.
 */
const logger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } as any;

const flatten = (items: any[]): any[] => items.flatMap((item) => [item, ...flatten(item.children ?? [])]);

describe('admin menu permissions', () => {
  const plugin = {
    slug: 'shop',
    name: 'Shop',
    admin: {
      group: 'Commerce',
      menu: [
        { label: 'Overview', path: '/shop' },
        { label: 'Orders', path: '/shop/orders' },
        { label: 'My work', path: '/shop/me', permission: 'shop:own' },
      ],
      slots: [{ slot: 'admin.plugin.shop.page.shop' }, { slot: 'admin.plugin.shop.page.shop.me' }],
    },
  };
  const collections = new Map<string, any>([
    ['shop_orders', { pluginSlug: 'shop', collection: { slug: 'shop_orders', shortSlug: 'orders', fields: [] } }],
    ['shop_products', { pluginSlug: 'shop', collection: { slug: 'shop_products', shortSlug: 'products', fields: [] } }],
  ]);
  const menu = flatten(new AdminMenuBuilderService(logger, new AdminSystemNavigationMetadataService())
    .build([{ manifest: plugin } as any], [plugin], collections));
  const permissionOf = (label: string) => menu.find((item) => item.label === label)?.permission;

  it('a collection list asks for reading that collection', () => {
    expect(permissionOf('Orders')).toBe('shop:orders:read');
    expect(permissionOf('Products')).toBe('shop:products:read');
  });

  it('another screen of the plugin asks for its own screens and actions', () => {
    expect(permissionOf('Overview')).toBe('shop:manage');
  });

  it('an item that declares its permission keeps it', () => {
    expect(permissionOf('My work')).toBe('shop:own');
  });

  it('framework screens name the permission their API checks, or none (administrators only)', () => {
    expect(permissionOf('Users')).toBe('users:view');
    expect(permissionOf('Activity')).toBe('system:view');
    expect(permissionOf('Settings')).toBeUndefined();
    expect(permissionOf('Plugins')).toBeUndefined();
  });
});

describe('plugin route gate', () => {
  it('checks the roles in effect for the request, not the account', async () => {
    const previous = process.env.ENFORCE_AUTHZ_GATEWAY;
    process.env.ENFORCE_AUTHZ_GATEWAY = 'true';
    const asked: Array<[string[], string]> = [];
    ApiAccessGate.setPermissionChecker((roles, permission) => { asked.push([roles, permission]); return roles.includes('shop-manager'); });
    const gate = ApiAccessGate.build(undefined)!;
    const run = (roles: string[]) => new Promise<number>((resolve) => {
      const res: any = { status: (code: number) => ({ json: () => resolve(code) }) };
      gate({ originalUrl: '/api/v1/plugins/shop/orders', user: { id: 5, roles } } as any, res, () => resolve(200));
    });
    expect(await run(['shop-manager'])).toBe(200);
    expect(await run(['customer'])).toBe(403);
    expect(asked[0]).toEqual([['shop-manager'], 'shop:manage']);
    process.env.ENFORCE_AUTHZ_GATEWAY = previous;
  });
});
