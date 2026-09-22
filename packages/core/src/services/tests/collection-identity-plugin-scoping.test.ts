import { describe, expect, it } from 'vitest';
import { CollectionIdentityService } from '@core/services/collection-identity-service';

/**
 * Two plugins may name a collection the same thing, and several do: `categories` belongs to both
 * ecommerce and cms, `tags` to more than that. A reference that names its plugin must land inside
 * that plugin.
 *
 * It did not. The candidate set for `ecommerce-categories` includes the bare tail `categories` so
 * that legacy unprefixed references keep working, and the CMS collection's `shortSlug` is exactly
 * `categories` — so the match came down to registry order. On a real catalogue CMS won: every
 * product's category id was looked up in `fcp_cms_categories`, 404'd, and rendered as
 * "Deleted item (13)" while category 13 sat in `fcp_ecommerce_categories` the whole time. Nothing
 * logged, and the field declaration was correct.
 *
 * The registry here is ordered CMS-first deliberately — that is the order that fails.
 */
describe('CollectionIdentityService plugin-scoped slug resolution', () => {
  const service = new CollectionIdentityService();

  const collections = [
    { slug: 'cms-categories', shortSlug: 'categories', pluginSlug: 'cms' },
    { slug: 'ecommerce-categories', shortSlug: 'categories', pluginSlug: 'ecommerce' },
    { slug: 'media', shortSlug: 'media', pluginSlug: '' },
  ];

  it('resolves a prefixed reference to its OWN plugin, not to the one registered first', () => {
    expect(service.resolveRegisteredSlug('ecommerce-categories', collections)).toBe('ecommerce-categories');
  });

  it('resolves the other side of the same collision correctly too', () => {
    expect(service.resolveRegisteredSlug('cms-categories', collections)).toBe('cms-categories');
  });

  it('honours the @plugin/collection spelling', () => {
    expect(service.resolveRegisteredSlug('@ecommerce/categories', collections)).toBe('ecommerce-categories');
  });

  it('honours the physical table spelling', () => {
    expect(service.resolveRegisteredSlug('ecommerce_categories', collections)).toBe('ecommerce-categories');
  });

  /** An explicit plugin argument is a filter, so it must never widen to another plugin's match. */
  it('keeps an explicit plugin filter narrow', () => {
    expect(service.resolveRegisteredSlug('categories', collections, 'ecommerce')).toBe('ecommerce-categories');
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
    const withHyphenatedName = [{ slug: 'product-tags', shortSlug: 'product-tags', pluginSlug: 'ecommerce' }];
    expect(service.resolveRegisteredSlug('product-tags', withHyphenatedName)).toBe('product-tags');
  });

  it('returns the reference unchanged when nothing matches', () => {
    expect(service.resolveRegisteredSlug('ecommerce-widgets', collections)).toBe('ecommerce-widgets');
  });

  it('returns empty for an empty reference', () => {
    expect(service.resolveRegisteredSlug('', collections)).toBe('');
  });
});
