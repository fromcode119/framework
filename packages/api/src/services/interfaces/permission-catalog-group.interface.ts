import type { IPermissionDefinition } from '@fromcode119/core';
import type { IPermissionCatalogCollection } from '@api/services/interfaces/permission-catalog-collection.interface';

/** The framework, or one plugin: everything a role can be given in that area. */
export interface IPermissionCatalogGroup {
  /** `framework`, or the plugin's slug. */
  key: string;
  label: string;
  /** The wildcard covering the whole area (`<plugin>:*`); absent for the framework group. */
  all?: string;
  permissions: IPermissionDefinition[];
  collections: IPermissionCatalogCollection[];
}
