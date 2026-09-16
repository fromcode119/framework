import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantMode } from '@core/tenant/tenant-mode';
import { StringUtils } from '@core/utils/string-utils';

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
  private static async siteMembers(manager: IPluginManagerInterface): Promise<Map<number, string[]> | null> {
    if (!TenantMode.isEnabled()) return null;
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!tenantId) return null;

    const memberships = await manager.db
      .find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenantId } })
      .catch(() => [] as any[]);

    const members = new Map<number, string[]>();
    for (const row of (Array.isArray(memberships) ? memberships : [])) {
      const membership = TenantMembership.from(row);
      if (!membership.isActive) continue;
      const id = Number(membership.userId);
      if (Number.isFinite(id) && id > 0) members.set(id, StringUtils.normalizeSlugList(membership.roles));
    }
    return members;
  }

  /**
   * The member rows themselves, fetched BY ID rather than paged and filtered.
   *
   * The limit has to apply INSIDE the site. Paging the newest N rows across the platform and
   * intersecting afterwards is the same query with a silent failure attached: where there are more
   * accounts than the cap, a site whose people registered early is simply not in the page being
   * filtered, and the answer returns EMPTY rather than wrong. Empty is the worse of the two here,
   * because these are the methods that resolve who receives a notification — a recipient list of zero
   * is dropped without an error, and nobody learns the message was never sent.
   */
  private static async membersPage(
    manager: IPluginManagerInterface,
    members: Map<number, string[]>,
    limit: number,
  ): Promise<any[]> {
    const ids = [...members.keys()];
    if (!ids.length) return [];
    const rows = await manager.db
      .find(SystemConstants.TABLE.USERS, { where: { id: { in: ids } }, orderBy: { created_at: 'desc' }, limit })
      .catch(() => [] as any[]);
    return Array.isArray(rows) ? rows : [];
  }

  /** Is this row a member of the bound site? `null` members means there is no site to narrow to. */
  private static isVisible(members: Map<number, string[]> | null, row: unknown): boolean {
    if (!row) return false;
    if (!members) return true;
    return members.has(Number((row as any)?.id));
  }

  /**
   * Does this account hold `role` HERE?
   *
   * The SITE's membership decides, not the global `users.roles` column. They disagree in a case this
   * platform actually produces: an account imported into a site carries THAT SITE's roles, so an
   * operator who is a customer of one site still reads as `admin` in the global column — and answering
   * from the column put them on that site's own admin notification list.
   */
  private static holdsRole(members: Map<number, string[]> | null, row: any, roles: string[]): boolean {
    if (members) {
      const held = members.get(Number(row?.id)) ?? [];
      return roles.some((role) => held.includes(role));
    }
    const global = StringUtils.normalizeSlugList(row?.roles);
    return roles.some((role) => global.includes(role));
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
        const members = await UsersContextProxy.siteMembers(manager);
        const rows = members
          ? await UsersContextProxy.membersPage(manager, members, limit)
          : await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
        return (Array.isArray(rows) ? rows : [])
          .filter((row: any) => UsersContextProxy.holdsRole(members, row, ['admin', 'superadmin']))
          .map(UsersContextProxy.toSafeUser)
          .filter((u) => u.email.includes('@'));
      },

      async findByRole(role: string, options?: { limit?: number }) {
        const normalizedRole = String(role ?? '').trim().toLowerCase();
        const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
        const members = await UsersContextProxy.siteMembers(manager);
        const rows = members
          ? await UsersContextProxy.membersPage(manager, members, limit)
          : await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
        return (Array.isArray(rows) ? rows : [])
          .filter((row: any) => UsersContextProxy.holdsRole(members, row, [normalizedRole]))
          .map(UsersContextProxy.toSafeUser)
          .filter((u) => u.email.includes('@'));
      },

      /**
       * NOT FOUND, rather than found-but-refused, for an account outside this site.
       *
       * These are the lookups a plugin steers with caller input — an id or an email from a form, a
       * hook, a request body — so unnarrowed they are an enumeration oracle over every account on the
       * platform: a hit says the address is registered somewhere, and the profile hands back the
       * holder's name. Callers then WRITE what they resolved, so another customer's email and real
       * name end up inside this site's own rows, reading back as if they belonged here.
       */
      async findById(id: any) {
        if (!id) return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.USERS, { id });
        if (!UsersContextProxy.isVisible(await UsersContextProxy.siteMembers(manager), row)) return null;
        return UsersContextProxy.toProfileUser(row);
      },

      async findByEmail(email: string) {
        const normalized = String(email ?? '').trim().toLowerCase();
        if (!normalized) return null;
        const row = await manager.db.findOne(SystemConstants.TABLE.USERS, { email: normalized });
        if (!UsersContextProxy.isVisible(await UsersContextProxy.siteMembers(manager), row)) return null;
        return UsersContextProxy.toProfileUser(row);
      },

      /** List users (safe profiles, newest first) — for generic "any user" needs without raw table access. */
      async list(options?: { limit?: number }): Promise<Array<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] }>> {
        const limit = Math.max(1, Math.min(500, options?.limit ?? 100));
        const members = await UsersContextProxy.siteMembers(manager);
        const rows = members
          ? await UsersContextProxy.membersPage(manager, members, limit)
          : await manager.db.find(SystemConstants.TABLE.USERS, { limit, orderBy: { created_at: 'desc' } });
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