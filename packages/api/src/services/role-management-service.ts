import { Schema } from '@fromcode119/database';
import { StringUtils, RequestContextUtils, PermissionGrants, RoleCatalog, RoleScope, SystemConstants } from '@fromcode119/core';
import type { IRoleCatalogEntry } from '@fromcode119/core';
import { RoleGrantError } from '@api/services/role-grant-error';
import { RoleScopeError } from '@api/services/role-scope-error';
import { SiteRoleScope } from '@api/services/tenants/site-role-scope';
import type { IRoleEditor } from '@api/services/interfaces/role-editor.interface';

/**
 * Roles and the permissions attached to them — read and written as one thing, because they are one.
 *
 * TWO catalogs, one on top of the other (see RoleCatalog). The PLATFORM's roles (`_system_roles`) are
 * the same on every site: every site sees them and grants them, and only a platform admin, in platform
 * scope, defines them. A SITE's own roles (`_system_site_roles`) belong to that site alone and are
 * managed from inside it. Before this split every site's administrator edited the one shared catalog —
 * able to give the `customer` role any permission on every other customer's site, or delete a role
 * another site's staff sign in with.
 *
 * Split out of `UserManagementService` (403 lines), which manages ACCOUNTS. The two met only through
 * the database, and every method here needs exactly one thing: the connection.
 */
export class RoleManagementService {
  constructor(private readonly db: any) {}

  /**
   * The roles, each with how many people HERE hold it, where it is defined, and whether this editor may
   * change it.
   *
   * `_system_users_roles` is a platform table with no row-level policy, so counting it whole told a
   * site how many accounts hold a role across the entire box. Bound to a site, the count is that site's
   * members holding the role. In platform scope it is the whole box, which is what an operator is asking.
   */
  async getRoles(editor: IRoleEditor = { platformAdmin: false }) {
    const tenantId = RoleManagementService.siteId();
    const site = await SiteRoleScope.current(this.db);
    const roles = (await new RoleCatalog(this.db).list(tenantId))
      // A site sees the framework's roles and its own plugins' — see SiteRoleScope.
      .filter((role) => !site || SiteRoleScope.isVisibleOnSite(role, tenantId as string));

    return Promise.all(roles.map(async (role) => {
      const users = site
        ? site.holdersOf(role.slug)
        : (await this.db.find(Schema.systemUsersToRoles, {
          columns: { userId: true },
          where: this.db.eq(Schema.systemUsersToRoles.roleSlug, role.slug),
        }) || []).length;
      return RoleManagementService.present(role, users, editor, tenantId);
    }));
  }

  async getRole(slug: string, editor: IRoleEditor = { platformAdmin: false }) {
    const tenantId = RoleManagementService.siteId();
    const role = (await new RoleCatalog(this.db).list(tenantId)).find((entry) => entry.slug === slug);
    if (!role) return null;

    // Counted the way the list counts it: a site's own members, not every account on the box.
    const site = await SiteRoleScope.current(this.db);
    const users = site
      ? site.holdersOf(role.slug)
      : await this.db.count(Schema.systemUsersToRoles, {
        where: this.db.eq(Schema.systemUsersToRoles.roleSlug, role.slug)
      });
    return RoleManagementService.present(role, users, editor, tenantId);
  }

  /**
   * Save a role. `grantor` is what the person saving it holds: a role may only be given permissions
   * its editor already has, so `roles:manage` alone cannot mint an administrator. Permissions the role
   * already carried are left alone — editing a role's description must not require holding all of it.
   *
   * Inside a site this writes THAT SITE's role, and refuses a platform role's slug: the site may grant
   * it, never redefine it. In platform scope it writes a platform role, and only a platform admin may.
   */
  async saveRole(slug: string, data: any, grantor: string[], editor: IRoleEditor = { platformAdmin: false }) {
    const tenantId = RoleManagementService.siteId();
    const catalog = new RoleCatalog(this.db);
    if (tenantId && await catalog.isPlatformRole(slug)) {
      throw new RoleScopeError(`"${slug}" is a platform role. It is the same on every site, so it can only be changed in platform scope.`);
    }
    if (!tenantId) RoleManagementService.assertPlatformEditor(editor);

    const requested = StringUtils.normalizeSlugList(data.permissions);
    const existing = (await catalog.list(tenantId)).find((role) => role.slug === slug);
    const kept = new Set(existing?.permissions ?? []);
    const beyond = requested.filter((name) => !kept.has(name) && !PermissionGrants.covers(grantor, name));
    if (beyond.length > 0) {
      throw new RoleGrantError(beyond);
    }

    const now = new Date();
    if (tenantId) {
      await this.saveSiteRole(slug, data, requested, now, Boolean(existing));
      return;
    }
    await this.db.upsert(Schema.systemRoles, {
      slug,
      name: data.name,
      description: data.description,
      type: data.type || 'custom',
      permissions: requested,
      // Provide timestamps explicitly: the declared table would otherwise emit its `.defaultNow()` (`now()`)
      // for these omitted columns, which the SQLite runtime rejects ("no such function: now").
      createdAt: now,
      updatedAt: now,
    }, {
      target: 'slug',
      set: {
        name: data.name,
        description: data.description,
        type: data.type || 'custom',
        permissions: requested,
        updatedAt: now
      }
    });
  }

  /**
   * Delete a role. Inside a site only that site's own role, and the slug is taken off the site's
   * memberships with it — a membership naming a role that no longer exists grants nothing and would
   * only mislead whoever reads it. In platform scope, a platform role, by a platform admin.
   */
  async deleteRole(slug: string, editor: IRoleEditor = { platformAdmin: false }) {
    const tenantId = RoleManagementService.siteId();
    if (tenantId) {
      if (await new RoleCatalog(this.db).isPlatformRole(slug)) {
        throw new RoleScopeError(`"${slug}" is a platform role. It is the same on every site, so it can only be deleted in platform scope.`);
      }
      await this.db.delete(SystemConstants.TABLE.SITE_ROLES, { slug, tenant_id: tenantId });
      const site = await SiteRoleScope.current(this.db);
      await site?.withdraw(slug);
      return true;
    }
    RoleManagementService.assertPlatformEditor(editor);
    await this.db.delete(Schema.systemRoles, { slug });
    return true;
  }

  /**
   * The permissions a role carries — read from its `permissions` column, the column the permission
   * checker enforces. The list used to come from the `_system_roles_permissions` join instead, which
   * only this editor wrote: a role a plugin declared (`context.roles.ensure`) carried its permission,
   * was granted it on every request, and was listed with "0 perms".
   */
  static permissionsOf(role: any): string[] {
    // Array or JSON-array string, depending on the dialect that stored it.
    return StringUtils.normalizeSlugList(role?.permissions);
  }

  /**
   * A site role is written through the raw table path, inside the request's site scope: the row's
   * `tenant_id` comes from the column default, and row-level security refuses a write into any other
   * site. The `tenant_id` in the WHERE is said as well, for a dialect without that policy.
   */
  private async saveSiteRole(slug: string, data: any, permissions: string[], now: Date, exists: boolean): Promise<void> {
    const tenantId = RoleManagementService.siteId() as string;
    const values = {
      name: data.name,
      description: data.description ?? '',
      // An array, not a string: the table path is json-column-aware and encodes it exactly once.
      permissions,
      updated_at: now,
    };
    if (exists) {
      await this.db.update(SystemConstants.TABLE.SITE_ROLES, { slug, tenant_id: tenantId }, values);
      return;
    }
    await this.db.insert(SystemConstants.TABLE.SITE_ROLES, { slug, tenant_id: tenantId, ...values, created_at: now });
  }

  private static assertPlatformEditor(editor: IRoleEditor): void {
    if (editor.platformAdmin) return;
    throw new RoleScopeError('Platform roles are the same on every site, so only a platform admin can change them. Open a site to manage its own roles.');
  }

  private static siteId(): string | null {
    return String(RequestContextUtils.getTenantId() ?? '').trim() || null;
  }

  /**
   * One role for the admin. `scope` says where it is defined and `editable` whether THIS editor may
   * change it here — so the screen can show a platform role read-only inside a site, with the reason,
   * instead of offering a Save the API will refuse.
   */
  private static present(role: IRoleCatalogEntry, users: number, editor: IRoleEditor, tenantId: string | null) {
    const site = role.scope === RoleScope.SITE;
    const editable = site ? Boolean(tenantId) : !tenantId && editor.platformAdmin;
    return {
      slug: role.slug,
      name: role.name,
      description: role.description,
      type: site ? 'custom' : String(role.raw?.type ?? 'custom'),
      pluginSlug: role.pluginSlug,
      permissions: role.permissions,
      users,
      scope: String(role.scope.value),
      editable,
    };
  }
}
