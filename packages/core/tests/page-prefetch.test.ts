import { describe, expect, it } from 'vitest';
import { PagePrefetch } from '@core/page-prefetch';
import { RuntimeConstants } from '@core/constants/runtime.constants';

describe('PagePrefetch on the server', () => {
  it('answers the payload of the render it is inside, and nothing outside it', () => {
    PagePrefetch.renderWith({ 'navigation-main': { items: [1] } }, () => {
      expect(PagePrefetch.get('navigation-main')).toEqual({ items: [1] });
      expect(PagePrefetch.get('missing')).toBeNull();
    });
    expect(PagePrefetch.get('navigation-main')).toBeNull();
  });

  it('cannot be written through, and the legacy name is a read-only view of it', () => {
    PagePrefetch.installLegacyAlias();
    const name = RuntimeConstants.GLOBALS.PAGE_PREFETCH;
    PagePrefetch.renderWith({ a: 1 }, () => {
      expect(Object.isFrozen(PagePrefetch.all())).toBe(true);
      expect((globalThis as Record<string, any>)[name].a).toBe(1);
      expect(() => { (globalThis as Record<string, any>)[name] = { a: 2 }; }).toThrow();
      expect(PagePrefetch.get('a')).toBe(1);
    });
  });
});
