import { describe, expect, it } from 'vitest';
import { PublicListing } from '@core/public-listing/public-listing';
import { PublicListingSurface } from '@core/public-listing/public-listing-surface.enum';

const shown = (visibility: unknown) => [PublicListingSurface.CATALOG, PublicListingSurface.SEARCH, PublicListingSurface.SITEMAP]
  .filter((surface) => PublicListing.shownIn({ visibility }, surface)).map((surface) => surface.value);

describe('PublicListing', () => {
  it('lists each value on its own surfaces', () => {
    expect(shown('public')).toEqual(['catalog', 'search', 'sitemap']);
    expect(shown('catalog_only')).toEqual(['catalog', 'sitemap']);
    expect(shown('search_only')).toEqual(['search']);
    expect(shown('hidden')).toEqual([]);
  });

  it('reads a record stored before the field existed as Public, its default', () => {
    expect(shown(undefined)).toEqual(['catalog', 'search', 'sitemap']);
    expect(shown('')).toEqual(['catalog', 'search', 'sitemap']);
    expect(PublicListing.shownIn(null, PublicListingSurface.CATALOG)).toBe(true);
  });

  it('lists an unrecognised value nowhere', () => {
    expect(shown('everywhere')).toEqual([]);
  });

  it('declares the field with only the options a collection offers', () => {
    const field = PublicListing.field([PublicListing.PUBLIC, PublicListing.HIDDEN]);
    expect(field).toMatchObject({ name: 'visibility', type: 'select', defaultValue: 'public' });
    expect((field.options as Array<{ value: string }>).map((option) => option.value)).toEqual(['public', 'hidden']);
    expect((PublicListing.field().options as unknown[]).length).toBe(4);
  });
});
