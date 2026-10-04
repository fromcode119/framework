import { describe, expect, it, vi } from 'vitest';
import { CollectionsContextProxy } from '@core/plugin/context/collections';

const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;
const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as any;

function buildManager() {
  const registeredCollections = new Map<string, { collection: any; pluginSlug: string }>();
  return {
    registeredCollections,
    emit: vi.fn(),
    getCollection: (slug: string) => registeredCollections.get(slug),
  } as any;
}

const products = (readOnly: boolean, extra: any[] = []) => ({
  slug: 'products',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'variantOptions', type: 'json', admin: { readOnly, component: 'StructuredReadOnlyField' } },
    ...extra,
  ],
});

/**
 * An isolated plugin updated in place re-runs onInit in its new process, which registers its
 * collections again. Before, that only ADDED unseen fields: a field turned writable by the release
 * stayed read-only in the api until it restarted, so every save of it was refused.
 */
describe('a plugin re-registering its own collection', () => {
  it('replaces the field definitions held since boot and adds new ones', () => {
    const manager = buildManager();
    const collections = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'shop' } } as any, manager, logger, security);
    collections.register(products(true) as any);
    collections.register(products(false, [{ name: 'sku', type: 'text' }]) as any);

    const fields = manager.registeredCollections.get('fcp_shop_products').collection.fields;
    expect(fields.find((field: any) => field.name === 'variantOptions').admin.readOnly).toBe(false);
    expect(fields.filter((field: any) => field.name === 'variantOptions')).toHaveLength(1);
    expect(fields.map((field: any) => field.name)).toContain('sku');
  });

  it('swaps in a new fields array, so caches keyed by the array recompute', () => {
    const manager = buildManager();
    const collections = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'shop' } } as any, manager, logger, security);
    collections.register(products(true) as any);
    const before = manager.registeredCollections.get('fcp_shop_products').collection.fields;
    collections.register(products(false) as any);
    expect(manager.registeredCollections.get('fcp_shop_products').collection.fields).not.toBe(before);
  });

  it('keeps a field the release no longer declares — another plugin may have extended the collection', () => {
    const manager = buildManager();
    const collections = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'shop' } } as any, manager, logger, security);
    collections.register(products(true, [{ name: 'giftNote', type: 'text' }]) as any);
    collections.register(products(false) as any);

    const names = manager.registeredCollections.get('fcp_shop_products').collection.fields.map((field: any) => field.name);
    expect(names).toContain('giftNote');
  });

  it('takes the new access and hooks — the old ones call a process that is gone', () => {
    const manager = buildManager();
    const collections = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'shop' } } as any, manager, logger, security);
    const oldRead = vi.fn(() => true);
    collections.register({ ...products(true), access: { read: oldRead }, hooks: { afterChange: [vi.fn()] } } as any);
    collections.register({ ...products(true), access: { read: true } } as any);
    const collection = manager.registeredCollections.get('fcp_shop_products').collection;
    expect(collection.access).toEqual({ read: true });
    expect(collection.hooks).toBeUndefined();
  });
});
