import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { StringUtils } from '@core/utils/string-utils';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { RoleScope } from '@core/tenant/enums/role-scope.enum';
import type { IRoleCatalogEntry } from '@core/tenant/interfaces/role-catalog-entry.interface';

/**
 * The roles in force for a site: the PLATFORM's roles, then that site's own.
 *
 * The platform is on top. Its roles are visible to every site and editable only in platform scope,
 * and when a site role shares a slug with a platform role the platform's definition wins — a site can
 * add roles, never redefine one the platform owns. (A site cannot create such a clash: the editor
 * refuses a platform slug. It can only arise when the platform later adds a role a site already had.)
 *
 * The site's rows are row-level scoped, so they are read INSIDE that site's scope. A caller already in
 * that scope — any request bound to the site — reads them directly; one that is not (login, which
 * runs before any site is bound, and the console's site switcher) is given a scope for the read. Without
 * that, a site role's permissions were invisible at exactly the moment a session is minted.
 */
export class RoleCatalog {
  constructor(private readonly db: any) {}

  /** Platform roles, plus `tenantId`'s own when one is given. */
  async list(tenantId?: string | null): Promise<IRoleCatalogEntry[]> {
    const platform = ((await this.db.find(SystemConstants.TABLE.ROLES, { limit: 500 })) ?? [])
      .map((row: any) => RoleCatalog.entry(row, RoleScope.PLATFORM));
    const site = String(tenantId ?? '').trim();
    if (!site) return platform;
    const taken = new Set(platform.map((role: IRoleCatalogEntry) => role.slug));
    const own = (await this.readSiteRows(site))
      .map((row: any) => RoleCatalog.entry(row, RoleScope.SITE))
      .filter((role: IRoleCatalogEntry) => !taken.has(role.slug));
    return [...platform, ...own];
  }

  /** The permissions `roles` carry on `tenantId` (or on the platform alone, with no site). */
  async permissionsFor(roles: string[], tenantId?: string | null): Promise<string[]> {
    const slugs = StringUtils.normalizeSlugList(roles, []);
    if (slugs.length === 0) return [];
    const catalog = await this.list(tenantId);
    return [...new Set(catalog.filter((role) => slugs.includes(role.slug)).flatMap((role) => role.permissions))];
  }

  /** Whether `slug` is a platform role — which a site may assign but never define. */
  async isPlatformRole(slug: string): Promise<boolean> {
    return Boolean(await this.db.findOne(SystemConstants.TABLE.ROLES, { slug }));
  }

  /**
   * The site's own rows. Row-level security is what separates them; the `tenant_id` filter is said as
   * well, so a dialect without row-level security can never widen this read to every site's roles.
   */
  private async readSiteRows(tenantId: string): Promise<any[]> {
    const read = async () => ((await this.db.find(SystemConstants.TABLE.SITE_ROLES, { limit: 500 })) ?? [])
      .filter((row: any) => CoercionUtils.toString(row?.tenant_id) === tenantId);
    if (String(RequestContextUtils.getTenantId() ?? '').trim() === tenantId) return read();
    return this.db.withTenant(tenantId, read);
  }

  private static entry(row: any, scope: RoleScope): IRoleCatalogEntry {
    return {
      slug: CoercionUtils.toString(row?.slug),
      name: CoercionUtils.toString(row?.name),
      description: row?.description == null ? null : CoercionUtils.toString(row.description),
      // Array or JSON-array string, depending on the dialect that stored it.
      permissions: StringUtils.normalizeSlugList(row?.permissions),
      scope,
      // snake_case: framework code reads through the RAW manager, which does not denormalize.
      pluginSlug: row?.plugin_slug ?? null,
      raw: row ?? {},
    };
  }
}
