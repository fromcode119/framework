import { describe, it, expect, vi, afterEach } from 'vitest';
import { PageDocPrefetcher } from '@/lib/theme/page-doc-prefetcher';
import { PluginPagePrefetcher } from '@/lib/theme/plugin-page-prefetcher';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';

// A plugin's own page loaded its list after mount, so the server sent a spinner: the plugin now declares
// the records its page needs, and the storefront fetches them before rendering.
describe('PluginPagePrefetcher', () => {
  const plugins = [{
    slug: 'shop',
    ui: { pagePrefetch: [{ recipe: 'shop.index', key: 'list', path: 'items', query: { limit: '24', view: 'card' }, requestQuery: { category: 'categorySlug' } }] },
  }];

  afterEach(() => vi.restoreAllMocks());

  it('fetches the declaring plugin\'s own route with the fixed and the address\'s parameters, sorted', async () => {
    const fetchEntry = vi.spyOn(ThemeDataPrefetcher, 'fetchEntry').mockResolvedValue([{ id: 1 }]);
    const results = await PageDocPrefetcher.prefetch({ recipe: 'shop.index', content: [] }, { ui: {} }, plugins, '?category=kids&utm=x');
    expect(String(fetchEntry.mock.calls[0][0])).toContain('/plugins/shop/items?categorySlug=kids&limit=24&view=card');
    expect(results['shop:list']).toEqual({ query: 'categorySlug=kids&limit=24&view=card', data: [{ id: 1 }] });
  });

  it('fetches nothing for a page of another recipe, or a page with none', async () => {
    const fetchEntry = vi.spyOn(ThemeDataPrefetcher, 'fetchEntry').mockResolvedValue([]);
    expect(await PageDocPrefetcher.prefetch({ recipe: 'other', content: [] }, { ui: {} }, plugins, '')).toEqual({});
    expect(await PageDocPrefetcher.prefetch({ content: [] }, { ui: {} }, plugins, '')).toEqual({});
    expect(fetchEntry).not.toHaveBeenCalled();
  });

  it('refuses a route that leaves the plugin\'s base, and leaves out a fetch that came back empty', async () => {
    const fetchEntry = vi.spyOn(ThemeDataPrefetcher, 'fetchEntry').mockResolvedValue(undefined);
    const results: Record<string, unknown> = {};
    const escaping = [{ slug: 'shop', ui: { pagePrefetch: [
      { recipe: 'r', key: 'a', path: '../system/users' },
      { recipe: 'r', key: 'b', path: 'https://evil.example/x' },
      { recipe: 'r', key: 'c', path: 'items' },
    ] } }];
    await PluginPagePrefetcher.prefetch({ recipe: 'r' }, escaping, '', 'http://api', results);
    expect(fetchEntry).toHaveBeenCalledTimes(1);
    expect(String(fetchEntry.mock.calls[0][0])).toContain('/plugins/shop/items');
    expect(results).toEqual({});
  });

  describe('a plugin\'s own record page', () => {
    const owning = [{ slug: 'shop', ui: { pagePrefetch: [{ collection: 'catalog', key: 'item', path: 'items/:slug' }] } }];

    it('fetches the record\'s route with its own field, for a record the site resolved from that plugin\'s collection', async () => {
      const fetchEntry = vi.spyOn(ThemeDataPrefetcher, 'fetchEntry').mockResolvedValue({ id: 7, slug: 'бебешка-дрънкалка' });
      const results = await PageDocPrefetcher.prefetch({ slug: 'бебешка-дрънкалка' }, { ui: {} }, owning, '', { plugin: 'shop', type: 'catalog' });
      expect(String(fetchEntry.mock.calls[0][0])).toContain(`/plugins/shop/items/${encodeURIComponent('бебешка-дрънкалка')}`);
      expect(results['shop:item']).toEqual({ query: '', data: { id: 7, slug: 'бебешка-дрънкалка' } });
    });

    it('fetches nothing for another plugin\'s record, another collection, a page no plugin resolved, or a recipe page', async () => {
      const fetchEntry = vi.spyOn(ThemeDataPrefetcher, 'fetchEntry').mockResolvedValue({});
      expect(await PageDocPrefetcher.prefetch({ slug: 'x' }, { ui: {} }, owning, '', { plugin: 'blog', type: 'catalog' })).toEqual({});
      expect(await PageDocPrefetcher.prefetch({ slug: 'x' }, { ui: {} }, owning, '', { plugin: 'shop', type: 'brands' })).toEqual({});
      expect(await PageDocPrefetcher.prefetch({ slug: 'x' }, { ui: {} }, owning, '')).toEqual({});
      expect(await PageDocPrefetcher.prefetch({ slug: 'x', recipe: 'shop.index' }, { ui: {} }, owning, '')).toEqual({});
      expect(fetchEntry).not.toHaveBeenCalled();
    });

    it('fills a route only from a field the record holds as one path segment', () => {
      expect(PluginPagePrefetcher.routeFor('items/:slug', { slug: 'a/b' })).toBe('');
      expect(PluginPagePrefetcher.routeFor('items/:slug', { slug: '..' })).toBe('');
      expect(PluginPagePrefetcher.routeFor('items/:slug', { slug: { bg: 'x' } })).toBe('');
      expect(PluginPagePrefetcher.routeFor('items/:slug', {})).toBe('');
      expect(PluginPagePrefetcher.routeFor('items/:slug', null)).toBe('');
      expect(PluginPagePrefetcher.routeFor('items/:slug', { slug: 'rattle' })).toBe('items/rattle');
    });
  });

  it('takes an address parameter only when the page has it', () => {
    const entry = { query: { limit: '24' }, requestQuery: { category: 'categorySlug', tag: 'tag' } };
    expect(PluginPagePrefetcher.queryOf(entry, new URLSearchParams('tag=red')).toString()).toBe('limit=24&tag=red');
  });
});
