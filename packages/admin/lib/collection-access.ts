import { PermissionGrants } from '@fromcode119/core/utils/permission-grants';
import { PermissionNames } from '@fromcode119/core/utils/permission-names';
import { CollectionPermissionAction } from '@fromcode119/core/enums/collection-permission-action.enum';

/**
 * What the signed-in user may do to one collection's records, by the same permission names the
 * collections API checks (`<plugin>:<collection>:<action>`). The list and record screens ask this
 * before offering New, Edit, Duplicate or Delete — a button that answers "forbidden" when pressed
 * is a control that does not do what it says.
 */
export class CollectionAccess {
  private constructor(
    readonly canCreate: boolean,
    readonly canUpdate: boolean,
    readonly canDelete: boolean,
  ) {}

  static readonly FULL = new CollectionAccess(true, true, true);

  static for(user: any, collection: any): CollectionAccess {
    if (!collection || user?.roles?.includes('admin')) return CollectionAccess.FULL;
    const pluginSlug = String(collection.pluginSlug ?? '').trim();
    // A collection with no owning plugin has no name a role could hold; its routes are administrators'.
    if (!pluginSlug || collection.system) return new CollectionAccess(false, false, false);
    const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    const key = PermissionNames.collectionKey(collection);
    const can = (action: CollectionPermissionAction) => PermissionGrants.covers(permissions, PermissionNames.collection(pluginSlug, key, action));
    return new CollectionAccess(can(CollectionPermissionAction.CREATE), can(CollectionPermissionAction.UPDATE), can(CollectionPermissionAction.DELETE));
  }
}
