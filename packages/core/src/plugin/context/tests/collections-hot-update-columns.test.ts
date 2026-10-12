import { describe, expect, it, vi } from 'vitest';
import { CollectionsContextProxy } from '@core/plugin/context/collections';

/**
 * A plugin updated in place registers its collections again. A field the release added joined the
 * collection at once, so reads selected its column before the table had it ("column … does not exist")
 * until the update's own table sync ran — 29 s after the new process started, once on production.
 */
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;
const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as any;

function setup() {
  const registeredCollections = new Map<string, { collection: any; pluginSlug: string }>();
  let release!: () => void;
  const synced: string[][] = [];
  const schemaManager = {
    syncCollection: vi.fn((collection: any) => {
      synced.push(collection.fields.map((field: any) => field.name));
      return new Promise<void>((resolve) => { release = resolve; });
    }),
  };
  const manager = { registeredCollections, emit: vi.fn(), getCollection: (slug: string) => registeredCollections.get(slug), schemaManager } as any;
  const collections = CollectionsContextProxy.createCollectionsProxy({ manifest: { slug: 'shop' } } as any, manager, logger, security);
  const names = () => registeredCollections.get('fcp_shop_products')!.collection.fields.map((field: any) => field.name);
  return { manager, collections, schemaManager, synced, names, release: () => release() };
}

const products = (extra: any[] = [], access: any = { read: true }) => ({ slug: 'products', access, fields: [{ name: 'title', type: 'text' }, ...extra] });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a hot update that adds a field', () => {
  it('keeps the new field out of the collection until its column exists, and applies the rest at once', async () => {
    const { collections, schemaManager, synced, names, release, manager } = setup();
    collections.register(products() as any);
    manager.emit.mockClear();

    const settled = collections.register(products([{ name: 'outOfStockNote', type: 'text' }], { read: false }) as any) as unknown as Promise<void>;

    expect(names()).toEqual(['title']);
    expect(manager.registeredCollections.get('fcp_shop_products').collection.access).toEqual({ read: false });
    await flush();
    expect(names()).toEqual(['title']);
    expect(schemaManager.syncCollection).toHaveBeenCalledTimes(1);
    expect(synced[0]).toContain('outOfStockNote');
    // Announced at once: the hot update's prune drops a collection the new process did not announce.
    expect(manager.emit).toHaveBeenCalledTimes(1);
    expect(settled).toBeInstanceOf(Promise);

    release();
    await settled;
    expect(names()).toContain('outOfStockNote');
    expect(manager.emit).toHaveBeenCalledTimes(2);
    expect(manager.emit).toHaveBeenLastCalledWith('collection:registered', expect.objectContaining({ pluginSlug: 'shop' }));
  });

  it('touches no table when the release adds no field', () => {
    const { collections, schemaManager, manager } = setup();
    collections.register(products() as any);
    manager.emit.mockClear();
    collections.register(products([], { read: false }) as any);
    expect(schemaManager.syncCollection).not.toHaveBeenCalled();
    expect(manager.emit).toHaveBeenCalledTimes(1);
  });

  it('runs a second registration\'s sync only after the first finished', async () => {
    const { collections, schemaManager, release } = setup();
    collections.register(products() as any);
    collections.register(products([{ name: 'a', type: 'text' }]) as any);
    collections.register(products([{ name: 'b', type: 'text' }]) as any);
    await flush();
    expect(schemaManager.syncCollection).toHaveBeenCalledTimes(1);
    release();
    await flush();
    expect(schemaManager.syncCollection).toHaveBeenCalledTimes(2);
    release();
    await flush();
  });
});
