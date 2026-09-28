import type { CollectionPermissionAction } from '@core/enums/collection-permission-action.enum';

/**
 * How a permission is spelled, stated once.
 *
 * The API gate, the collection policy, the admin menu and the role editor all have to agree on these
 * names. When each one built its own string, a role could be given a permission that no gate asked
 * for, which looked like access in the editor and was refused everywhere else.
 *
 * - `<plugin>:*`                      everything the plugin offers (covers every name below)
 * - `<plugin>:manage`                 the plugin's own screens and actions (its API routes)
 * - `<plugin>:<collection>:<action>`  one operation on one of the plugin's collections
 */
export class PermissionNames {
  /** Everything: what the administrator role holds. */
  static readonly ALL = '*';

  static pluginAll(pluginSlug: string): string {
    return `${PermissionNames.key(pluginSlug)}:*`;
  }

  static pluginManage(pluginSlug: string): string {
    return `${PermissionNames.key(pluginSlug)}:manage`;
  }

  static collection(pluginSlug: string, collectionSlug: string, action: CollectionPermissionAction): string {
    return `${PermissionNames.key(pluginSlug)}:${PermissionNames.key(collectionSlug)}:${action.value}`;
  }

  /**
   * The name a collection is known by inside its plugin — the one its admin URL uses
   * (`/shop/products`), not the prefixed table-level slug.
   */
  static collectionKey(collection: { slug: string; shortSlug?: string; unprefixedSlug?: string }): string {
    return PermissionNames.key(collection.shortSlug || collection.unprefixedSlug || collection.slug);
  }

  private static key(value: string): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
