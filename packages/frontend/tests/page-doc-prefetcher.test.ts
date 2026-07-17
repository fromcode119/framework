import { RuntimeConstants } from '@fromcode119/core/client';
import { describe, it, expect } from 'vitest';
import { PageDocPrefetcher } from '../lib/theme/page-doc-prefetcher';

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
