import { NamingStrategy } from '@fromcode119/database';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantState } from '@core/enums/tenant-state.enum';
import { SystemConstants } from '@core/constants/system.constants';
import { StringUtils } from '@core/utils/string-utils';

export class RolesContextProxy {

  /**
   * User ids holding a role — the UNION of the `users_roles` junction and the `users.roles` JSON
   * column (the JSON is what the permission checker reads; the junction is only guaranteed for rows
   * written via assignRole). Static so both the id and email proxy methods share it without relying
   * on `this` (proxy methods may be detached by callers).
   */
  /**
   * The user ids holding a role FOR THE SITE this call is acting in.
   *
   * A plugin asking "who are the admins?" means the admins of the site whose request it is serving —
   * `context.notifications.notifyAdmins` is the everyday caller. Resolved globally, as it was, a shop
   * on one site emailed its order notifications to every other customer's administrators, and wrote an
   * in-app notification into each of their inboxes: someone else's order totals, in someone else's
   * console. On a multi-site platform a role is only ever meaningful WITH a site.
   *
   * Membership roles are authoritative here, exactly as they are for request guards — the account's
   * global roles say what it is elsewhere, not here. Untenanted callers (boot, platform work, a
   * single-tenant deployment) keep the global answer, which is the right one when there is no site.
   */
  private static async resolveUserIdsWithRole(manager: IPluginManagerInterface, slug: string): Promise<number[]> {
    const roleSlug = String(slug).trim().toLowerCase();
    if (!roleSlug) return [];

    const tenantId = TenantMode.isEnabled() ? String(RequestContextUtils.getTenantId() ?? '').trim() : '';
    if (tenantId) {
      const memberships = await manager.db
        .find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenantId } })
        .catch(() => [] as any[]);
      const scoped = new Set<number>();
      for (const row of (Array.isArray(memberships) ? memberships : [])) {
        const membership = TenantMembership.from(row);
        if (!membership.isActive) continue;
        if (!StringUtils.normalizeSlugList(membership.roles).includes(roleSlug)) continue;
        const id = Number(membership.userId);
        if (Number.isFinite(id) && id > 0) scoped.add(id);
      }
      return Array.from(scoped);
    }

    const ids = new Set<number>();
    const rows = await manager.db.find(SystemConstants.TABLE.USERS_ROLES, { where: { roleSlug } }).catch(() => []);
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const id = Number(NamingStrategy.denormalizeRecord(row)?.userId);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
    const users = await manager.db.find(SystemConstants.TABLE.USERS, { limit: 5000 }).catch(() => []);
    for (const user of (Array.isArray(users) ? users : [])) {
      const record = NamingStrategy.denormalizeRecord(user);
      if (StringUtils.normalizeSlugList((record as any)?.roles).includes(roleSlug)) {
        const id = Number(record?.id);
        if (Number.isFinite(id) && id > 0) ids.add(id);
      }
    }
    return Array.from(ids);
  }

  /**
   * Creates a roles proxy for plugins.
   * Plugins should use context.roles.ensure() instead of querying the system roles table directly.
   */
  static createRolesProxy(manager: IPluginManagerInterface) {
    // Runtime authorization (UserPermissionChecker) reads a user's roles from the `users.roles` JSON
    // column — NOT the junction table. assign/removeRole must keep that column in sync or granting/
    // revoking a role is a silent no-op for access control (mirrors the API's saveUserRoles fix). Reads
    // the current JSON, applies the mutation, and writes back via the STRING-table path (stringifies once).
    const syncUsersRolesJson = async (uid: number, mutate: (roles: string[]) => string[]): Promise<void> => {
      const user = await manager.db.findOne(SystemConstants.TABLE.USERS, { id: uid }).catch(() => null);
      if (!user) return;
      // `users.roles` may be an array or a JSON-array string; the util handles both.
      const current = StringUtils.normalizeSlugList((user as any).roles);
      const next = StringUtils.normalizeSlugList(mutate(current));
      await manager.db.update(SystemConstants.TABLE.USERS, { id: uid }, { roles: next, updatedAt: new Date() });
    };

    return {
      async ensure(slug: string, data: { name: string; description?: string; type?: string; permissions?: any[] }): Promise<void> {
        const existing = await manager.db.findOne(SystemConstants.TABLE.ROLES, { slug });
        if (!existing) {
          await manager.db.insert(SystemConstants.TABLE.ROLES, {
            slug,
            name: data.name,
            description: data.description ?? '',
            type: data.type ?? 'custom',
            permissions: JSON.stringify(data.permissions ?? [])
          });
        }
      },

      /** Grant a role to a user (idempotent). Writes the junction AND the `users.roles` JSON column. */
      async assignRole(userId: number | string, slug: string): Promise<void> {
        const uid = Number(userId);
        if (!uid || !slug) return;
        const roleSlug = String(slug).trim().toLowerCase();
        const existing = await manager.db.findOne(SystemConstants.TABLE.USERS_ROLES, { userId: uid, roleSlug });
        if (!existing) {
          await manager.db.insert(SystemConstants.TABLE.USERS_ROLES, { userId: uid, roleSlug });
        }
        await syncUsersRolesJson(uid, (roles) => (roles.includes(roleSlug) ? roles : [...roles, roleSlug]));
      },

      /**
       * Give a user access to THIS SITE, or change the roles that access carries.
       *
       * A site is a membership, not a second account (see {@link TenantMembership}): one global user,
       * one row per site they may enter. Without such a row the framework refuses the login outright
       * with `workspace_access_denied` — which is the trap this method exists to close. A plugin that
       * hands someone a portal account but no membership has given them a login they cannot use, and
       * the failure appears at sign-in rather than at the grant, far away from the cause.
       *
       * Idempotent, and it REACTIVATES a suspended membership rather than inserting a second one —
       * two rows for one person on one site would make "what roles do they have here?" ambiguous.
       *
       * Untenanted (single-site, or boot) is a no-op: there is no site to be a member of, and every
       * account already reaches everything.
       */
      async grantSiteMembership(userId: number | string, roles: string[] = []): Promise<void> {
        const uid = Number(userId);
        if (!uid || !TenantMode.isEnabled()) return;
        const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
        if (!tenantId) return;

        const roleList = StringUtils.normalizeSlugList(roles);
        const existing = await manager.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(uid), tenant_id: tenantId });
        if (existing) {
          await manager.db.update(
            SystemConstants.TABLE.TENANT_MEMBERSHIPS,
            { user_id: String(uid), tenant_id: tenantId },
            { roles: roleList, state: TenantState.ACTIVE.value },
          );
          return;
        }
        await manager.db.insert(SystemConstants.TABLE.TENANT_MEMBERSHIPS, {
          user_id: String(uid),
          tenant_id: tenantId,
          roles: roleList,
          state: TenantState.ACTIVE.value,
        });
      },

      /**
       * Withdraw a user's access to THIS SITE.
       *
       * Marks the membership INACTIVE rather than deleting it: the row is the audit trail of who was let in, and a deleted one
       * answers no questions afterwards. The login survives — this removes the site, not the account.
       */
      async revokeSiteMembership(userId: number | string): Promise<void> {
        const uid = Number(userId);
        if (!uid || !TenantMode.isEnabled()) return;
        const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
        if (!tenantId) return;
        await manager.db.update(
          SystemConstants.TABLE.TENANT_MEMBERSHIPS,
          { user_id: String(uid), tenant_id: tenantId },
          { state: TenantState.INACTIVE.value },
        );
      },

      /** Revoke a role from a user (no-op if not assigned). Updates the junction AND the `users.roles` JSON. */
      async removeRole(userId: number | string, slug: string): Promise<void> {
        const uid = Number(userId);
        if (!uid || !slug) return;
        const roleSlug = String(slug).trim().toLowerCase();
        await manager.db.delete(SystemConstants.TABLE.USERS_ROLES, { userId: uid, roleSlug });
        await syncUsersRolesJson(uid, (roles) => roles.filter((r) => r !== roleSlug));
      },

      /**
       * List the user ids that currently hold a given role. Roles live in TWO places — the
       * `users_roles` junction AND the `users.roles` JSON column (the JSON is what the permission
       * checker reads; the junction is only guaranteed for rows written via assignRole) — so this
       * resolves the UNION of both. Otherwise a user granted `admin` outside assignRole (seed, direct
       * save) would be invisible to role-targeted notifications.
       */
      async listUserIdsWithRole(slug: string): Promise<number[]> {
        return RolesContextProxy.resolveUserIdsWithRole(manager, slug);
      },

      /**
       * Resolve the EMAIL addresses of users holding a role (deduped, lowercased). The framework owns
       * the join across the `users`/`users_roles` SYSTEM tables so plugins never read them directly —
       * use this for admin-notification recipients (e.g. `listUserEmailsWithRole('admin')`).
       */
      async listUserEmailsWithRole(slug: string): Promise<string[]> {
        if (!slug) return [];
        // Same junction+JSON union as listUserIdsWithRole — email resolution must see the same users.
        const ids = await RolesContextProxy.resolveUserIdsWithRole(manager, slug);
        const emails = new Set<string>();
        for (const id of ids) {
          const user = await manager.db.findOne(SystemConstants.TABLE.USERS, { id }).catch(() => null);
          const email = String(NamingStrategy.denormalizeRecord(user)?.email || '').trim().toLowerCase();
          if (email) emails.add(email);
        }
        return Array.from(emails);
      }
    };

  }
}