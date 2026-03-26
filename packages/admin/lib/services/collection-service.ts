import { CoreServices } from '@fromcode119/core/client';
import { BaseService } from './base-service';

/**
 * Service for collection slug and key normalisation utilities.
 *
 * Centralises the fuzzy slug-matching logic used by relationship
 * and tag field components so it is testable and not duplicated.
 *
 * @example
 * ```typescript
 * const services = AdminServices.getInstance();
 * const key = services.collection.normalizeKey('ecommerce_products'); // 'ecommerce-products'
 * const slug = services.collection.resolveSlug('@ecommerce/products', allCollections);
 * ```
 */
export class CollectionService extends BaseService {
  /**
   * Normalises a collection key to a canonical lowercase-hyphenated form.
   * Replaces underscores with hyphens and trims whitespace.
   */
  normalizeKey(value: unknown): string {
    return CoreServices.getInstance().collectionIdentity.normalizeKey(value);
  }

  /**
   * Resolves an ambiguous collection slug to the registered slug.
   * Handles legacy physical slugs and plugin-slug/collection combinations.
   *
   * @param rawSlug     - The slug as supplied (may be prefixed/underscored)
   * @param collections - Live collection registry
   */
  resolveSlug(rawSlug: string, collections: Array<{ slug?: string; shortSlug?: string; pluginSlug?: string }>): string {
    return CoreServices.getInstance().collectionIdentity.resolveRegisteredSlug(rawSlug, collections);
  }
}
