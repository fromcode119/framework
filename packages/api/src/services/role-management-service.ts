import { IDatabaseManager, Schema } from '@fromcode119/database';
import { StringUtils, RequestContextUtils, PermissionGrants } from '@fromcode119/core';
import { RoleGrantError } from '@api/services/role-grant-error';
import { SiteRoleScope } from '@api/services/tenants/site-role-scope';

/**
 * Roles and the permissions attached to them — read and written as one thing, because they are one.
 *
 * A role is not a column on a user. It is a row other rows point at, so renaming or deleting one has
 * to consider what still references it; a permission is a row under a role, which is why saving one
 * is a write against the role rather than against whatever asked.
 *
 * Split out of `UserManagementService` (403 lines), which manages ACCOUNTS. The two met only through
 * the database, and every method here needs exactly one thing: the connection.
 */
export class RoleManagementService {
  constructor(private readonly db: any) {}

  /**
   * The roles, each with how many people HERE hold it.
   *
   * `_system_users_roles` is a platform table with no row-level policy, so counting it whole told a
   * site how many accounts hold a role across the entire box. Measured before this change: site
   * "initech", one member, reported 25 for `partner` — which is the global total exactly, and belongs
   * to another product's customers. A count a site cannot account for is worse than no count: it
   * invites someone to go looking for 24 people who are not there.
   *
   * Bound to a site, the count is that site's members holding the role. In platform scope it is the
   * whole box, which is what an operator is asking.
   */
  async getRoles() {
    const allRoles = await this.db.find(Schema.systemRoles);
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();

    // A site sees the framework's roles and its own plugins', and counts holders from its memberships —
    // the roles that authorize them there. See SiteRoleScope.
    const site = await SiteRoleScope.current(this.db);
    const dbRoles = site
      ? allRoles.filter((role: any) => SiteRoleScope.isVisibleOnSite(role, tenantId))
      : allRoles;

    return Promise.all(dbRoles.map(async (role: any) => {
      const userCount = site
        ? site.holdersOf(String(role.slug))
        : (await this.db.find(Schema.systemUsersToRoles, {
          columns: { userId: true },
          where: this.db.eq(Schema.systemUsersToRoles.roleSlug, role.slug),
        }) || []).length;
      return { ...role, permissions: RoleManagementService.permissionsOf(role), users: userCount };
    }));
  }

  /**
   * Save a role. `grantor` is what the person saving it holds: a role may only be given permissions
   * its editor already has, so `roles:manage` alone cannot mint an administrator. Permissions the role
   * already carried are left alone — editing a role's description must not require holding all of it.
   */
  async saveRole(slug: string, data: any, grantor: string[]) {
    const requested = StringUtils.normalizeSlugList(data.permissions);
    const existing = await this.db.findOne(Schema.systemRoles, { slug });
    const kept = new Set(RoleManagementService.permissionsOf(existing));
    const beyond = requested.filter((name) => !kept.has(name) && !PermissionGrants.covers(grantor, name));
    if (beyond.length > 0) {
      throw new RoleGrantError(beyond);
    }
    data = { ...data, permissions: requested };

    const now = new Date();
    await this.db.upsert(Schema.systemRoles, {
      slug,
      name: data.name,
      description: data.description,
      type: data.type || 'custom',
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      // Provide timestamps explicitly: drizzle would otherwise emit the pg `.defaultNow()` (`now()`)
      // for these omitted columns, which the SQLite runtime rejects ("no such function: now").
      createdAt: now,
      updatedAt: now,
    }, {
      target: 'slug',
      set: {
        name: data.name,
        description: data.description,
        type: data.type || 'custom',
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        updatedAt: now
      }
    });
  }

  async getRole(slug: string) {
    const role = await this.db.findOne(Schema.systemRoles, { slug });
    if (!role) return null;

    // Counted the way the list counts it: a site's own members, not every account on the box.
    const site = await SiteRoleScope.current(this.db);
    const userCount = site
      ? site.holdersOf(String(role.slug))
      : await this.db.count(Schema.systemUsersToRoles, {
        where: this.db.eq(Schema.systemUsersToRoles.roleSlug, role.slug)
      });
    return {
      ...role,
      permissions: RoleManagementService.permissionsOf(role),
      users: userCount
    };
  }

  /**
   * The permissions a role carries — read from `_system_roles.permissions`, the column the permission
   * checker enforces. The list used to come from the `_system_roles_permissions` join instead, which
   * only this editor wrote: a role a plugin declared (`context.roles.ensure`) carried its permission,
   * was granted it on every request, and was listed with "0 perms".
   */
  static permissionsOf(role: any): string[] {
    // Array or JSON-array string, depending on the dialect that stored it.
    return StringUtils.normalizeSlugList(role?.permissions);
  }

  async deleteRole(slug: string) {
    await this.db.delete(Schema.systemRoles, { slug });
    return true;
  }
}
