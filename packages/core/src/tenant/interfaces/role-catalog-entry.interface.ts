import type { RoleScope } from '@core/tenant/enums/role-scope.enum';

/** One role as a reader sees it, with where it is defined (see RoleCatalog). */
export interface IRoleCatalogEntry {
  slug: string;
  name: string;
  description: string | null;
  permissions: string[];
  scope: RoleScope;
  /** The plugin that declared a platform role, if one did. */
  pluginSlug: string | null;
  raw: Record<string, unknown>;
}
