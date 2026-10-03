import { RuntimeConstants } from '@fromcode119/core/client';
import { describe, it, expect } from 'vitest';
import { PageDocPrefetcher } from '@/lib/theme/page-doc-prefetcher';

describe('PageDocPrefetcher.deriveValues', () => {
  it('derives the page slug by default', () => {
    const values = PageDocPrefetcher.deriveValues(
      { slug: 'vision-board', content: [] },
      { queryParam: 'slugs' },
    );
    expect(values).toEqual(['vision-board']);
  });

  it('collects generic block slug references, deduped and capped', () => {
    const doc = {
      slug: 'landing',
      content: [
        { data: { slugs: ['a', 'b', { slug: 'c' }] } },
        { data: { productSlugs: ['a'], productSlug: 'd' } },
      ],
    };
    const values = PageDocPrefetcher.deriveValues(doc, {
      queryParam: 'slugs',
      sources: ['pageSlug', 'blockSlugs'],
      maxValues: 4,
    });
    expect(values).toEqual(['landing', 'a', 'b', 'c']);
  });

  it('rejects non-slug-shaped values (query-string injection guard)', () => {
    const doc = { slug: 'ok', content: [{ data: { slugs: ['bad&x=1', 'we ird', 'fine-2'] } }] };
    const values = PageDocPrefetcher.deriveValues(doc, { queryParam: 'slugs', sources: ['pageSlug', 'blockSlugs'] });
    expect(values).toEqual(['ok', 'fine-2']);
  });

  it('returns [] without a queryParam or without a doc', () => {
    expect(PageDocPrefetcher.deriveValues({ slug: 'x' }, { queryParam: '' } as any)).toEqual([]);
    expect(PageDocPrefetcher.deriveValues(null, { queryParam: 'slugs' })).toEqual([]);
  });
});

describe('PageDocPrefetcher.buildMergeScript', () => {
  it('merges into the shared global and escapes markup-significant characters', () => {
    const script = PageDocPrefetcher.buildMergeScript({ k: '</script><b>&' });
    expect(script.startsWith(`window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}=Object.assign(window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}||{},`)).toBe(true);
    expect(script).not.toContain('</script>');
    expect(script).toContain('\\u003c');
  });
});

describe('PageDocPrefetcher.datasourceQuery', () => {
  // A block narrowed by one of its datasource's filters was prefetched as the whole list, so its first
  // paint held whichever of the newest records matched — often fewer than it shows.
  it('sends the paging, the sort, the filters the operator set and the card view', () => {
    const query = PageDocPrefetcher.datasourceQuery({ limit: 8, sort: '-id', filterValues: { tag: 'summer', size: '', nested: { a: 1 } } });
    expect(Object.fromEntries(query)).toEqual({ limit: '8', sort: '-id', tag: 'summer', view: 'card' });
  });

  it('reads the older single filter pair, and the filter map wins over it', () => {
    expect(PageDocPrefetcher.datasourceQuery({ filterKey: 'tag', filterValue: 'winter' }).get('tag')).toBe('winter');
    expect(PageDocPrefetcher.datasourceQuery({ filterKey: 'tag', filterValue: 'winter', filterValues: { tag: 'summer' } }).get('tag')).toBe('summer');
  });

  it('asks only for the card view when the block declares nothing', () => {
    expect(Object.fromEntries(PageDocPrefetcher.datasourceQuery(null))).toEqual({ view: 'card' });
  });
});

describe('PageDocPrefetcher.prefetch', () => {
  // Every page-scoped prefetch used a bare `fetch` that named no site; on a multi-site deployment the API
  // refused each one, so no page payload was ever emitted. And a theme without page-derived entries never
  // prefetched its datasource blocks at all.
  const doc = { content: [{ id: 'grid-1', type: 'collection', data: { pluginSlug: 'shop', datasourceKey: 'items', limit: 6, filterValues: { tag: 'new' } } }] };

  it('fetches datasource blocks through the site-aware fetch, for a theme with no page entries', async () => {
    const { ThemeDataPrefetcher } = await import('@/lib/theme/theme-data-prefetcher');
    const fetchEntry = vi.spyOn(ThemeDataPrefetcher, 'fetchEntry').mockResolvedValue([{ id: 1 }]);
    const results = await PageDocPrefetcher.prefetch(doc, { ui: {} });
    expect(fetchEntry).toHaveBeenCalledTimes(1);
    const url = String(fetchEntry.mock.calls[0][0]);
    expect(url).toContain('/plugins/shop/items?');
    expect(url).toContain('tag=new');
    expect(url).toContain('view=card');
    expect(results['datasource:grid-1']).toEqual([{ id: 1 }]);
    fetchEntry.mockRestore();
  });

  it('leaves a block out when its fetch comes back empty', async () => {
    const { ThemeDataPrefetcher } = await import('@/lib/theme/theme-data-prefetcher');
    const fetchEntry = vi.spyOn(ThemeDataPrefetcher, 'fetchEntry').mockResolvedValue(undefined);
    expect(await PageDocPrefetcher.prefetch(doc, { ui: {} })).toEqual({});
    fetchEntry.mockRestore();
  });
});
