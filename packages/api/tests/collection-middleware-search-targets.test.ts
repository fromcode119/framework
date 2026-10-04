import { describe, expect, it, vi } from 'vitest';
import { PluginState } from '@fromcode119/core';
import { CollectionMiddleware } from '@api/middlewares/collection-middleware';

/**
 * The related tables a list search can match through are resolved against the whole collection
 * registry — work only a request that searches uses, which every read used to pay for.
 */
describe('CollectionMiddleware relationship search targets', () => {
  const products: any = { slug: 'fcp_shop_products', fields: [{ name: 'name', type: 'text' }] };
  const inventory: any = { slug: 'fcp_shop_inventory', fields: [{ name: 'product', type: 'relationship', relationTo: 'fcp_shop_products' }] };
  const entries: Record<string, any> = {
    fcp_shop_products: { pluginSlug: 'shop', collection: products },
    fcp_shop_inventory: { pluginSlug: 'shop', collection: inventory },
  };
  const manager: any = {
    getCollection: vi.fn((slug: string) => entries[slug]),
    getCollections: vi.fn(() => Object.values(entries).map((entry) => entry.collection)),
    getPlugins: () => [{ manifest: { slug: 'shop' }, state: PluginState.ACTIVE }],
  };
  const run = async (query: Record<string, unknown>) => {
    const req: any = { params: { slug: 'fcp_shop_inventory' }, query };
    const next = vi.fn();
    await new CollectionMiddleware(manager).handle(req, { status: vi.fn() } as any, next);
    expect(next).toHaveBeenCalled();
    return req;
  };

  it('resolves them for a search, and not for any other read', async () => {
    expect((await run({ search: 'tee' })).relationshipSearchTargets).toEqual([
      { field: 'product', tableName: 'fcp_shop_products', columns: ['name'], primaryKey: 'id' },
    ]);
    manager.getCollections.mockClear();
    const plain = await run({ limit: '20' });
    expect(plain.relationshipSearchTargets).toBeUndefined();
    expect(manager.getCollections).not.toHaveBeenCalled();
    expect((await run({ search: '  ' })).relationshipSearchTargets).toBeUndefined();
  });
});
