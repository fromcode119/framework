import { describe, it, expect } from 'vitest';
import { CollectionAccess } from '@/lib/collection-access';

const orders = { slug: 'shop_orders', shortSlug: 'orders', pluginSlug: 'shop' };

describe('CollectionAccess', () => {
  it('offers each operation by the permission the collections API checks', () => {
    const access = CollectionAccess.for({ roles: ['clerk'], permissions: ['shop:orders:read', 'shop:orders:update'] }, orders);
    expect([access.canCreate, access.canUpdate, access.canDelete]).toEqual([false, true, false]);
  });

  it('offers a plugin-contributed action only to a user who may use that plugin\'s routes', () => {
    const clerk = CollectionAccess.for({ roles: ['clerk'], permissions: ['shop:orders:read', 'reviews:manage'] }, orders);
    expect(clerk.allowsPluginAction({ pluginSlug: 'shop' })).toBe(false);
    expect(clerk.allowsPluginAction({ pluginSlug: 'reviews' })).toBe(true);
    expect(CollectionAccess.for({ roles: ['m'], permissions: ['shop:*'] }, orders).allowsPluginAction({ pluginSlug: 'shop' })).toBe(true);
  });

  it('an administrator is offered everything', () => {
    const admin = CollectionAccess.for({ roles: ['admin'], permissions: [] }, orders);
    expect([admin.canCreate, admin.canUpdate, admin.canDelete, admin.allowsPluginAction({ pluginSlug: 'shop' })]).toEqual([true, true, true, true]);
  });

  it('the list offers no create or edit on rows the collection says the runtime writes', () => {
    const log = { ...orders, admin: { disableCreate: true, disableEdit: true } };
    const admin = CollectionAccess.forList({ roles: ['admin'], permissions: [] }, log);
    expect([admin.canCreate, admin.canUpdate, admin.canDelete]).toEqual([false, false, true]);
    expect(admin.allowsPluginAction({ pluginSlug: 'shop' })).toBe(true);
    const createOnly = CollectionAccess.forList({ roles: ['admin'], permissions: [] }, { ...orders, admin: { disableCreate: true } });
    expect([createOnly.canCreate, createOnly.canUpdate]).toEqual([false, true]);
    expect(CollectionAccess.forList({ roles: ['admin'], permissions: [] }, orders)).toBe(CollectionAccess.FULL);
  });
});
