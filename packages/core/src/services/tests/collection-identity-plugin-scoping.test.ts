import { describe, expect, it } from 'vitest';
import { CollectionIdentityService } from '@core/services/collection-identity-service';

/**
 * Two plugins may name a collection the same thing, and several do: `categories` belongs to both
 * a catalog plugin and a content plugin, `tags` to more than that. A reference that names its
 * plugin must land inside that plugin.
 *
 * It did not. The candidate set for `catalog-categories` includes the bare tail `categories` so
 * that legacy unprefixed references keep working, and the content plugin's `shortSlug` is exactly
 * `categories` — so the match came down to registry order. On a real catalogue the content plugin
 * won: every product's category id was looked up in the content plugin's table, 404'd, and rendered as
 * "Deleted item (13)" while category 13 sat in `fcp_catalog_categories` the whole time. Nothing
 * logged, and the field declaration was correct.
 *
 * The registry here is ordered CMS-first deliberately — that is the order that fails.
 */
describe('CollectionIdentityService plugin-scoped slug resolution', () => {
  const service = new CollectionIdentityService();

  const collections = [
    { slug: 'cms-categories', shortSlug: 'categories', pluginSlug: 'cms' },
    { slug: 'catalog-categories', shortSlug: 'categories', pluginSlug: 'catalog' },
    { slug: 'media', shortSlug: 'media', pluginSlug: '' },
  ];

  it('resolves a prefixed reference to its OWN plugin, not to the one registered first', () => {
    expect(service.resolveRegisteredSlug('catalog-categories', collections)).toBe('catalog-categories');
  });

  it('resolves the other side of the same collision correctly too', () => {
    expect(service.resolveRegisteredSlug('cms-categories', collections)).toBe('cms-categories');
  });

  it('honours the @plugin/collection spelling', () => {
    expect(service.resolveRegisteredSlug('@catalog/categories', collections)).toBe('catalog-categories');
  });

  it('honours the physical table spelling', () => {
    expect(service.resolveRegisteredSlug('catalog_categories', collections)).toBe('catalog-categories');
  });

  /** An explicit plugin argument is a filter, so it must never widen to another plugin's match. */
  it('keeps an explicit plugin filter narrow', () => {
    expect(service.resolveRegisteredSlug('categories', collections, 'catalog')).toBe('catalog-categories');
    expect(service.resolveRegisteredSlug('categories', collections, 'cms')).toBe('cms-categories');
  });

  /** The regression edge: a reference naming no plugin must resolve exactly as it always did. */
  it('still resolves an unprefixed reference', () => {
    expect(service.resolveRegisteredSlug('media', collections)).toBe('media');
  });

  /**
   * `product-tags` looks prefixed but `product` is not a plugin, so the restricted pass finds
   * nothing and the unrestricted pass has to answer — otherwise this fix would break every
   * hyphenated collection name that is not a plugin prefix.
   */
  it('falls back to the unrestricted pass when the implied plugin does not exist', () => {
    const withHyphenatedName = [{ slug: 'product-tags', shortSlug: 'product-tags', pluginSlug: 'catalog' }];
    expect(service.resolveRegisteredSlug('product-tags', withHyphenatedName)).toBe('product-tags');
  });

  it('returns the reference unchanged when nothing matches', () => {
    expect(service.resolveRegisteredSlug('catalog-widgets', collections)).toBe('catalog-widgets');
  });

  it('returns empty for an empty reference', () => {
    expect(service.resolveRegisteredSlug('', collections)).toBe('');
  });
});
