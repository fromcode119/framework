import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantMode } from '@core/tenant/tenant-mode';

export class UsersContextProxy {

  /**
   * The ids of the people who belong to THIS SITE, or `null` when there is no site to narrow to.
   *
   * `users` is a single GLOBAL table and is deliberately not row-level-security scoped — migration 021
   * says so, because anything needed to RESOLVE tenancy cannot itself be tenant-scoped. Verified on a
   * live box as the non-superuser role: `people` and `media` answer 0 under a bound session while
   * `users` answers all 30, bound or not. So every read of that table here has to narrow itself; RLS
   * will not do it.
   *
   * This is the same correction already made to `RolesContextProxy.resolveUserIdsWithRole`, which
   * carries the post-mortem for what happens without it: "a shop on one site emailed its order
   * notifications to every other customer's administrators." These methods are the ones plugins use
   * to answer "who are the admins", so they had the same reach by the same route.
   *
   * `null` means no narrowing — a single-tenant deployment, or a background job with no site bound,
   * where "everyone" is the honest answer.
   */
  private static async siteMemberIds(manager: IPluginManagerInterface): Promise<Set<number> | null> {
    if (!TenantMode.isEnabled()) return null;
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!tenantId) return null;

    const memberships = await manager.db
      .find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenantId } })
      .catch(() => [] as any[]);

    const ids = new Set<number>();
    for (const row of (Array.isArray(memberships) ? memberships : [])) {
      const membership = TenantMembership.from(row);
      if (!membership.isActive) continue;
      const id = Number(membership.userId);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
    return ids;
  }

  /** Keeps only the rows belonging to this site. A `null` scope means every row stands. */
  private static narrow(rows: unknown, scope: Set<number> | null): any[] {
    const list = Array.isArray(rows) ? rows : [];
    if (!scope) return list;
    return list.filter((row: any) => scope.has(Number(row?.id)));
  }

  /**
   * Creates a safe, read-only users proxy for plugins.
   * Plugins should use context.users.* instead of querying the system users table directly.
   */
  static createUsersProxy(
    _plugin: ILoadedPlugin,
    manager: IPluginManagerInterface
  ) {
    return {
      async findAdmins(options?: { limit?: number }) {
        const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
        const scope = await UsersContextProxy.siteMemberIds(manager);
        const rows = await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
        return UsersContextProxy.narrow(rows, scope)
          .map(UsersContextProxy.toSafeUser)
          .filter((u) => u.email.includes('@'))
          .filter((u) => u.roles.some((r) => r === 'admin' || r === 'superadmin'));
      },

      async findByRole(role: string, options?: { limit?: number }) {
        const normalizedRole = String(role ?? '').trim().toLowerCase();
        const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
        const scope = await UsersContextProxy.siteMemberIds(manager);
        const rows = await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
        return UsersContextProxy.narrow(rows, scope)
          .map(UsersContextProxy.toSafeUser)
          .filter((u) => u.email.includes('@'))
          .filter((u) => u.roles.includes(normalizedRole));
      },

      async findById(id: any) {
        if (!id) return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.USERS, { id });
        return UsersContextProxy.toProfileUser(row);
      },

      async findByEmail(email: string) {
        const normalized = String(email ?? '').trim().toLowerCase();
        if (!normalized) return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.USERS, { email: normalized });
        return UsersContextProxy.toProfileUser(row);
      },

      /** List users (safe profiles, newest first) — for generic "any user" needs without raw table access. */
      async list(options?: { limit?: number }): Promise<Array<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] }>> {
        const limit = Math.max(1, Math.min(500, options?.limit ?? 100));
        const scope = await UsersContextProxy.siteMemberIds(manager);
        const rows = UsersContextProxy.narrow(
          await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } }),
          scope,
        );
        const out: Array<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] }> = [];
        for (const row of rows) {
          const profile = UsersContextProxy.toProfileUser(row);
          if (profile) out.push(profile);
        }
        return out;
      },

      /**
       * Create a user through the framework (plugins must NOT insert into the `users` system table via
       * context.db — that path is blocked). The caller passes an ALREADY-HASHED password (hash it with
       * context.auth.hashPassword); the framework owns the only write to the users table. Idempotent:
       * returns the existing user's id if the email is already taken.
       */
      async create(input: { email: string; password: string; roles?: string[]; firstName?: string; lastName?: string }): Promise<{ id: any } | null> {
        const email = String(input?.email ?? '').trim().toLowerCase();
        if (!email.includes('@')) return null;
        const existing = await manager.db.findOne(SystemConstants.TABLE.USERS, { email });
        if (existing?.id != null) return { id: existing.id };
        const row: any = await manager.db.insert(SystemConstants.TABLE.USERS, {
          email,
          password: String(input?.password ?? ''),
          roles: Array.isArray(input?.roles) && input.roles.length ? input.roles : ['customer'],
          firstName: input?.firstName ? String(input.firstName) : null,
          lastName: input?.lastName ? String(input.lastName) : null,
        });
        const created = Array.isArray(row) ? row[0] : row;
        return created?.id != null ? { id: created.id } : null;
      }
    };

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static normalizeRoles(raw: any): string[] {
    if (Array.isArray(raw)) return raw.map((r: any) => String(r ?? '').toLowerCase()).filter(Boolean);
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }

  private static toSafeUser(row: any): { id: any; email: string; roles: string[] } {
    return {
      id: row?.id,
      email: String(row?.email ?? '').trim(),
      roles: UsersContextProxy.normalizeRoles(row?.roles)
    };
  }

  private static toProfileUser(row: any): { id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null {
    if (!row) return null;
    const email = String(row?.email ?? '').trim();
    if (!email.includes('@')) return null;
    return {
      id: row.id,
      email,
      username: String(row?.username ?? '').trim(),
      firstName: String(row?.firstName || row?.first_name || '').trim(),
      lastName: String(row?.lastName || row?.last_name || '').trim(),
      roles: UsersContextProxy.normalizeRoles(row?.roles)
    };
  }
}