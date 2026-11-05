import { describe, expect, it } from 'vitest';
import { PagePrefetch } from '@core/page-prefetch';

describe('PagePrefetch on the server', () => {
  it('answers the payload of the render it is inside, and nothing outside it', () => {
    PagePrefetch.renderWith({ 'navigation-main': { items: [1] } }, () => {
      expect(PagePrefetch.get('navigation-main')).toEqual({ items: [1] });
      expect(PagePrefetch.get('missing')).toBeNull();
    });
    expect(PagePrefetch.get('navigation-main')).toBeNull();
  });

  it('cannot be written through, and puts nothing on the global object', () => {
    PagePrefetch.renderWith({ a: 1 }, () => {
      expect(Object.isFrozen(PagePrefetch.all())).toBe(true);
      expect('__FC_PAGE_PREFETCH__' in globalThis).toBe(false);
      expect(PagePrefetch.get('a')).toBe(1);
    });
  });
});
