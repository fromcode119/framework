import { describe, expect, it, vi } from 'vitest';
import { PluginHostCollectionPrune } from '@core/plugin/host/plugin-host-collection-prune';

describe('PluginHostCollectionPrune', () => {
  const setup = () => {
    const listeners = new Set<(data: any) => void>();
    const kept = { slug: 'fcp_shop_products' };
    const retired = { slug: 'fcp_shop_reviews' };
    const other = { slug: 'fcp_blog_posts' };
    const manager: any = {
      hooks: { on: vi.fn((_e: string, fn: any) => listeners.add(fn)), off: vi.fn((_e: string, fn: any) => listeners.delete(fn)) },
      registeredCollections: new Map<string, any>([
        ['fcp_shop_products', { collection: kept, pluginSlug: 'shop' }],
        ['fcp_shop_reviews', { collection: retired, pluginSlug: 'shop' }],
        ['fcp_blog_posts', { collection: other, pluginSlug: 'blog' }],
      ]),
    };
    const emit = (data: any) => listeners.forEach((fn) => fn(data));
    return { manager, emit, kept, listeners };
  };
  const logger = { info: vi.fn() } as any;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('forgets a collection the replaced process registered and the new one did not', async () => {
    const { manager, emit, kept, listeners } = setup();
    const settled = PluginHostCollectionPrune.watch(manager, 'shop', logger);
    emit({ pluginSlug: 'shop', collection: kept });
    settled([Promise.resolve()]);
    await flush();

    expect([...manager.registeredCollections.keys()]).toEqual(['fcp_shop_products', 'fcp_blog_posts']);
    expect(listeners.size).toBe(0);
  });

  it('removes nothing when a registration of the new process failed', async () => {
    const { manager, emit, kept } = setup();
    const settled = PluginHostCollectionPrune.watch(manager, 'shop', logger);
    emit({ pluginSlug: 'shop', collection: kept });
    settled([Promise.resolve(), Promise.reject(new Error('boom'))]);
    await flush();

    expect(manager.registeredCollections.size).toBe(3);
  });
});
