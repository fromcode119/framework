import { renderToStaticMarkup } from 'react-dom/server';
import { PagePrefetchScriptView } from '@/components/page-prefetch-script';
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

describe('PagePrefetchScriptView', () => {
  it('emits inert JSON the accessor reads, never a script that writes a global', () => {
    const html = renderToStaticMarkup(PagePrefetchScriptView.render({ payload: { k: '</script><b>&' } }));
    expect(html.startsWith('<script type="application/json" data-fc-page-prefetch="">')).toBe(true);
    expect(html).not.toContain('window.');
    expect(html.match(/<\/script>/g)?.length).toBe(1);
    expect(html).toContain('\\u003c');
  });

  it('emits nothing for an empty payload', () => {
    expect(PagePrefetchScriptView.render({ payload: {} })).toBeNull();
  });
});
