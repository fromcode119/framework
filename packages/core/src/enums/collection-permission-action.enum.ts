import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * The four things a role may be allowed to do to a collection. Each one is its own permission
 * (`<plugin>:<collection>:<action>`), so a role can read orders without being able to delete them.
 */
export class CollectionPermissionAction extends Enum {
  static readonly READ = new CollectionPermissionAction('read');
  static readonly CREATE = new CollectionPermissionAction('create');
  static readonly UPDATE = new CollectionPermissionAction('update');
  static readonly DELETE = new CollectionPermissionAction('delete');

  private constructor(value: string) {
    super(value);
  }

  /** In the order a role editor shows them. */
  static all(): CollectionPermissionAction[] {
    return [
      CollectionPermissionAction.READ,
      CollectionPermissionAction.CREATE,
      CollectionPermissionAction.UPDATE,
      CollectionPermissionAction.DELETE,
    ];
  }
}
