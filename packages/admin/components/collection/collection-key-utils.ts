import { CoreServices } from '@fromcode119/core/client';

/**
 * Collection key normalization and slug resolution utilities.
 */
export class CollectionKeyUtils {
  /**
   * Normalises a collection key to a canonical lowercase-hyphenated form.
   * Used for fuzzy slug matching in relationship and tag field components.
   *
   * @example
   * CollectionKeyUtils.normalizeKey('ecommerce_products') // => 'ecommerce-products'
   * CollectionKeyUtils.normalizeKey('  My Collection  ')  // => 'my-collection'
   */
  static normalizeKey(value: unknown): string {
    return CoreServices.getInstance().collectionIdentity.normalizeKey(value);
  }

  /**
   * Resolves an ambiguous collection slug reference to the actual registered slug.
   * Tries direct match first, then fuzzy-normalised matching with prefix variants.
   * This handles legacy physical slugs and plugin-slug/collection combinations.
   *
   * @param rawSourceSlug - The slug as supplied by the field definition (may be prefixed/underscored)
   * @param collections   - Live collection registry from ContextHooks.usePlugins()
   * @returns Resolved slug or rawSourceSlug if no match found
   */
  static resolveSourceSlug(rawSourceSlug: string, collections: any[]): string {
    return CoreServices.getInstance().collectionIdentity.resolveRegisteredSlug(rawSourceSlug, collections);
  }
}
