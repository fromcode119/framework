import type { ICollection } from '@core/collections/interfaces/collection.interface';

/**
 * Which registered collection holds a storefront's pages.
 *
 * The framework must not name a plugin's collection — matching the literal `'pages'` against every
 * registration was exactly that, in two places. The owning plugin marks its own collection instead
 * (`static readonly storefrontPages = true`), and the framework asks who raised their hand.
 *
 * `null` is a real answer: a platform with no pages plugin installed has no such collection, and
 * callers report nothing rather than guessing a name.
 */
export class StorefrontPagesCollection {
  static find(registered: Map<string, { collection: ICollection; pluginSlug: string }>): {
    collection: ICollection;
    pluginSlug: string;
    shortSlug: string;
  } | null {
    for (const entry of registered.values()) {
      const collection = entry.collection as ICollection & { storefrontPages?: boolean; shortSlug?: string };
      if (collection.storefrontPages !== true) continue;
      return {
        collection: entry.collection,
        pluginSlug: entry.pluginSlug,
        shortSlug: String(collection.shortSlug || collection.slug || ''),
      };
    }
    return null;
  }
}
