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

  /**
   * What the LIST offers for this collection's rows: the user's access, narrowed by the collection's own
   * `admin.disableCreate` / `admin.disableEdit` — rows the runtime writes. The record page already refuses
   * both, so a Duplicate that opened a "cannot be created here" screen and a quick edit that saved past
   * the lock were controls that did not do what they offered. (The record page keeps `for()`: its
   * view-only notice and its deliberate override are about the user, not the declaration.)
   */
  static forList(user: any, collection: any): CollectionAccess {
    const access = CollectionAccess.for(user, collection);
    const admin = collection?.admin ?? {};
    if (admin.disableCreate !== true && admin.disableEdit !== true) return access;
    return new CollectionAccess(
      access.canCreate && admin.disableCreate !== true,
      access.canUpdate && admin.disableEdit !== true,
      access.canDelete,
      access.permissions,
    );
  }
}
