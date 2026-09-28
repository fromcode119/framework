/** One collection's row in the role editor: a permission per operation it supports. */
export interface IPermissionCatalogCollection {
  /** The collection's name inside its plugin (`products`), as its admin URL uses it. */
  key: string;
  label: string;
  /** Operation (`read` / `create` / `update` / `delete`) → the permission that grants it. */
  actions: Record<string, string>;
}
