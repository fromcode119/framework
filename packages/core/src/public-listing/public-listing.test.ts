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

  it('states the catalogue rule as a read constraint, unset rows included', () => {
    expect(PublicListing.readConstraint(PublicListingSurface.CATALOG)).toEqual({ visibility: { $in: ['public', 'catalog_only'], $orNull: true } });
    expect(PublicListing.readConstraint(PublicListingSurface.SEARCH)).toEqual({ visibility: { $in: ['public', 'search_only'], $orNull: true } });
  });

  it('a read of one record by its link finds it; anything else is a list', () => {
    const keys = ['id', 'slug'];
    expect(PublicListing.readRule({ params: { id: '7' } }, keys, PublicListingSurface.CATALOG)).toEqual({});
    expect(PublicListing.readRule({ query: { slug: 'summer' } }, keys, PublicListingSurface.CATALOG)).toEqual({ slug: 'summer' });
    const list = { visibility: { $in: ['public', 'catalog_only'], $orNull: true } };
    expect(PublicListing.readRule({ query: {} }, keys, PublicListingSurface.CATALOG)).toEqual(list);
    expect(PublicListing.readRule(undefined, keys, PublicListingSurface.CATALOG)).toEqual(list);
    // Values that only LOOK like one record cannot widen into a list of unlisted ones.
    expect(PublicListing.readRule({ query: { slug: { in: ['a', 'b'] } } }, keys, PublicListingSurface.CATALOG)).toEqual(list);
    expect(PublicListing.readRule({ query: { slug: ['a', 'b'] } }, keys, PublicListingSurface.CATALOG)).toEqual(list);
    expect(PublicListing.readRule({ query: { slug: 'a,b' } }, keys, PublicListingSurface.CATALOG)).toEqual(list);
  });
});
