import { describe, expect, it, vi } from 'vitest';
import { PluginCollectionActivationService } from '@core/plugin/services/plugin-collection-activation-service';

/**
 * Enabling a plugin that adds fields to ANOTHER plugin's collection syncs that collection too. Turning
 * SEO on where the shop was already active added `ogImage` to products but not its column, and every
 * product read failed until the api restarted.
 */
describe('PluginCollectionActivationService.syncPluginCollections — extended collections', () => {
  function setup() {
    const products = { slug: 'fcp_shop_products', fields: [{ name: 'name' }, { name: 'ogImage', extendedBy: 'seo' }] };
    const posts = { slug: 'fcp_blog_posts', fields: [{ name: 'title' }] };
    const meta = { slug: 'fcp_seo_meta', fields: [{ name: 'path' }] };
    const registeredCollections = new Map<string, any>([
      ['fcp_shop_products', { collection: products, pluginSlug: 'shop' }],
      ['fcp_blog_posts', { collection: posts, pluginSlug: 'blog' }],
      ['fcp_seo_meta', { collection: meta, pluginSlug: 'seo' }],
    ]);
    const plugins = new Map<string, any>([['seo', { manifest: { slug: 'seo', capabilities: ['database', 'database:write'] } }]]);
    const syncCollection = vi.fn().mockResolvedValue(undefined);
    const service = new PluginCollectionActivationService({ registeredCollections, plugins } as any, { syncCollection } as any, {} as any, { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() } as any);
    return { service, syncCollection, products, posts, meta };
  }

  it('syncs its own collections and the ones it extended, not unrelated ones', async () => {
    const { service, syncCollection, products, posts, meta } = setup();
    await service.syncPluginCollections('seo');
    expect(syncCollection).toHaveBeenCalledWith(meta);
    expect(syncCollection).toHaveBeenCalledWith(products);
    expect(syncCollection).not.toHaveBeenCalledWith(posts);
  });
});
