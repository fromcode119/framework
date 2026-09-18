import type { ICollection } from '@core/collections/interfaces/collection.interface';

/**
 * The one place a collection's human label is derived. A plugin author names a collection with
 * `displayName`; when they don't, the short slug stands in, capitalized. Written once because it
 * had already drifted into two copies (`admin-menu-builder-service`, `plugin-entity-registration-service`)
 * before this file existed — a third copy, in the import-plan catalog, would have been a fourth.
 */
export class CollectionLabelUtils {
  static labelFor(collection: Pick<ICollection, 'displayName'> | undefined, shortSlug: string): string {
    if (collection?.displayName) return collection.displayName;
    return shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1);
  }
}
