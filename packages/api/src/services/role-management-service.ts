import { IDatabaseManager, Schema } from '@fromcode119/database';
import { PluginManager, Logger, PluginState, StringUtils, PlatformOwnershipService, PlatformOwnershipError, PluginTenantAccess, RequestContextUtils, TenantMode, TenantMembershipService } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';
import { getTableName } from 'drizzle-orm';

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
  /** The join that attaches permissions to a role. Owned here, because only this class writes it. */
  private static readonly ROLES_PERMISSIONS_TABLE = getTableName(Schema.systemRolesToPermissions);

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

    // A SITE SEES THE FRAMEWORK'S ROLES AND ITS OWN PLUGINS', NEVER ANOTHER PRODUCT'S.
    //
    // `_system_roles` is global by design — role names are the platform's vocabulary — but plugins
    // declare roles into it too, so a site was shown roles belonging to extensions it does not run,
    // in its Roles screen and in the role picker on its Users page. It had no
    // way to know what they meant, and granting one would have been meaningless.
    //
    // An UNATTRIBUTED role stays visible. Migration 046 adds the column with no backfill because
    // nothing can honestly guess who created a role that predates it, and hiding one nobody can
    // account for is the worse failure — losing `admin` from the screen with no way to discover why.
    // `ensure` stamps each row as its plugin re-declares it, so this narrows itself as it learns.
    const dbRoles = TenantMode.isEnabled() && tenantId
      ? allRoles.filter((role: any) => {
        const owner = String(role?.pluginSlug ?? '').trim();
        return !owner || owner === 'system' || PluginTenantAccess.enabledSlugsFor(tenantId).has(owner);
      })
      : allRoles;
    const memberIds = TenantMode.isEnabled() && tenantId
      ? new Set(await new TenantMembershipService(this.db as never).listUserIdsForTenant(tenantId))
      : null;

    return Promise.all(dbRoles.map(async (role: any) => {
      const holders = await this.db.find(Schema.systemUsersToRoles, {
        columns: { userId: true },
        where: this.db.eq(Schema.systemUsersToRoles.roleSlug, role.slug),
      });
      const userCount = memberIds
        ? (holders || []).filter((row: any) => memberIds.has(Number(row?.userId))).length
        : (holders || []).length;
      const permsResult = await this.db.find(Schema.systemRolesToPermissions, {
        columns: { permissionName: true },
        where: this.db.eq(Schema.systemRolesToPermissions.roleSlug, role.slug)
      });
      return { ...role, permissions: permsResult.map((r: any) => r.permissionName), users: userCount };
    }));
  }

  async saveRole(slug: string, data: any) {
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

    if (Array.isArray(data.permissions)) {
      await this.db.delete(RoleManagementService.ROLES_PERMISSIONS_TABLE, { roleSlug: slug });
      if (data.permissions.length > 0) {
        for (const perm of data.permissions) {
          await this.db.insert(RoleManagementService.ROLES_PERMISSIONS_TABLE, { roleSlug: slug, permissionName: perm });
        }
      }
    }
  }

  async getRole(slug: string) {
    const role = await this.db.findOne(Schema.systemRoles, { slug });
    if (!role) return null;

    const userCount = await this.db.count(Schema.systemUsersToRoles, {
      where: this.db.eq(Schema.systemUsersToRoles.roleSlug, role.slug)
    });
    const permsResult = await this.db.find(Schema.systemRolesToPermissions, {
      columns: { permissionName: true },
      where: this.db.eq(Schema.systemRolesToPermissions.roleSlug, role.slug)
    });

    return {
      ...role,
      permissions: permsResult.map((r: any) => r.permissionName),
      users: userCount
    };
  }

  async deleteRole(slug: string) {
    await this.db.delete(Schema.systemRoles, { slug });
    return true;
  }

  async savePermission(data: any) {
    if (!data?.name) {
      throw new Error('Permission name is required');
    }

    const now = new Date();
    const existing = await this.db.findOne(SystemConstants.TABLE.PERMISSIONS, { name: data.name });
    const payload = {
      name: data.name,
      description: data.description || null,
      pluginSlug: data.pluginSlug || 'system',
      group: data.group || 'Other',
      impact: data.impact || 'Medium',
      updatedAt: now
    };

    if (existing) {
      await this.db.update(SystemConstants.TABLE.PERMISSIONS, { name: data.name }, payload);
      return;
    }

    try {
      await this.db.insert(SystemConstants.TABLE.PERMISSIONS, {
        ...payload,
        createdAt: now
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      if (!message.includes('UNIQUE constraint failed') && !message.toLowerCase().includes('duplicate')) {
        throw error;
      }

      await this.db.update(SystemConstants.TABLE.PERMISSIONS, { name: data.name }, payload);
    }
  }
}
