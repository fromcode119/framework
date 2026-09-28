/** One area of the permission catalog as `GET /system/admin/permissions` returns it. */
export interface IPermissionCatalogGroup {
  /** `framework`, or a plugin's slug. */
  key: string;
  label: string;
  /** The wildcard covering the whole area (`<plugin>:*`); absent for the framework. */
  all?: string;
  permissions: Array<{ name: string; label: string; description: string }>;
  collections: Array<{ key: string; label: string; actions: Record<string, string> }>;
}
