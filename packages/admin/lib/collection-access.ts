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
    private readonly permissions: readonly string[] | null,
  ) {}

  /**
   * Whether an action a PLUGIN adds to this screen is offered. It calls that plugin's own routes, which
   * the plugin route gate opens with `<plugin>:manage` — so without it the button could only be refused.
   * Pass as a Slot's `include`.
   */
  readonly allowsPluginAction = (contribution: { pluginSlug: string }): boolean =>
    this.permissions === null || PermissionGrants.covers(this.permissions, PermissionNames.pluginManage(contribution.pluginSlug));

  static readonly FULL = new CollectionAccess(true, true, true, null);

  static for(user: any, collection: any): CollectionAccess {
    if (user?.roles?.includes('admin')) return CollectionAccess.FULL;
    if (!collection) return new CollectionAccess(false, false, false, Array.isArray(user?.permissions) ? user.permissions : []);
    const pluginSlug = String(collection.pluginSlug ?? '').trim();
    // A collection with no owning plugin has no name a role could hold; its routes are administrators'.
    const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    if (!pluginSlug || collection.system) return new CollectionAccess(false, false, false, permissions);
    const key = PermissionNames.collectionKey(collection);
    const can = (action: CollectionPermissionAction) => PermissionGrants.covers(permissions, PermissionNames.collection(pluginSlug, key, action));
    return new CollectionAccess(can(CollectionPermissionAction.CREATE), can(CollectionPermissionAction.UPDATE), can(CollectionPermissionAction.DELETE), permissions);
  }
}
