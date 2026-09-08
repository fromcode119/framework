import { IDatabaseManager } from '@fromcode119/database';
import { Logger, StringUtils } from '@fromcode119/core';

export class UserPermissionChecker {
  private logger = new Logger({ namespace: 'permission-checker' });

  constructor(private db: IDatabaseManager) {}

  /**
   * Effective role slugs for a user = the legacy `users.roles` JSON column UNION the assignable
   * `_system_users_roles` junction (managed by the admin Roles UI and by plugins). Without this
   * union, roles granted only through the junction would never reach permission checks — a silent
   * no-op. Junction rows are snake_case (`role_slug`), the framework-internal raw-manager convention.
   *
   * These are the account's GLOBAL roles. On a multi-tenant deployment what an account may do is
   * decided per SITE, and the roles in effect for a request come from its membership — so a request
   * asks with `permissionsForRoles` / `hasPermissionForRoles` instead of going through here.
   */
  private async resolveUserRoleSlugs(userId: number, user: any): Promise<string[]> {
    let assigned: unknown[] = [];
    try {
      const rows = await this.db.find('_system_users_roles', { where: { userId } });
      assigned = (Array.isArray(rows) ? rows : []).map((row: any) => row?.role_slug);
    } catch {
      // Junction table may be absent on older installs — fall back to the JSON column only.
    }
    // `user.roles` may be an array or a JSON-array string; normalizeSlugList handles both + the junction.
    return StringUtils.normalizeSlugList(user?.roles, assigned);
  }

  /** The permissions these role slugs carry, from `_system_roles`. */
  async permissionsForRoles(roleSlugs: string[]): Promise<string[]> {
    const slugs = StringUtils.normalizeSlugList(roleSlugs, []);
    if (slugs.length === 0) return [];

    const allRoles = await this.db.find('_system_roles', { limit: 100 });
    const matched = (allRoles ?? []).filter((role: any) => slugs.includes(role.slug));

    const permissions: string[] = [];
    for (const role of matched) {
      try {
        const perms = typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : (role.permissions || []);
        if (Array.isArray(perms)) permissions.push(...perms);
      } catch (err) {
        this.logger.warn(`Failed to parse permissions for role ${role.slug}: ${String((err as any)?.message || err)}`);
      }
    }
    return [...new Set(permissions)];
  }

  /**
   * Does this permission set satisfy the requirement? `*` covers everything, an exact match covers
   * itself, and a `database:*` entry covers `database:read`.
   */
  static grants(permissions: string[], permission: string): boolean {
    if (permissions.includes('*') || permissions.includes(permission)) return true;
    return permissions.some((perm) => perm.endsWith(':*') && permission.startsWith(perm.slice(0, -1)));
  }

  /**
   * The check a REQUEST makes: against the roles in effect for it.
   *
   * On a multi-tenant deployment those are the account's roles on the site the request is acting in
   * (`AuthManager.useTenantRoles` narrows them from the membership), so an administrator of one site
   * gets that site's permissions and nothing on any other. Resolving from the account's global roles
   * here instead made membership roles decorative: they named the account an admin and every
   * permission-gated screen still refused it.
   */
  async hasPermissionForRoles(roleSlugs: string[], permission: string): Promise<boolean> {
    const permissions = await this.permissionsForRoles(roleSlugs);
    const granted = UserPermissionChecker.grants(permissions, permission);
    this.logger.debug(`Permission "${permission}" ${granted ? 'granted' : 'denied'} for roles [${roleSlugs.join(', ')}]`);
    return granted;
  }

  /** The account's GLOBAL answer — for callers outside a request (jobs, CLI, seeding). */
  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const roles = await this.globalRolesOf(userId);
    if (roles.length === 0) return false;
    return this.hasPermissionForRoles(roles, permission);
  }

  /** The account's GLOBAL permissions — see `hasPermission`. */
  async getUserPermissions(userId: number): Promise<string[]> {
    const roles = await this.globalRolesOf(userId);
    if (roles.length === 0) return [];
    return this.permissionsForRoles(roles);
  }

  private async globalRolesOf(userId: number): Promise<string[]> {
    const user = await this.db.findOne('users', { id: userId });
    if (!user) {
      this.logger.debug(`User ${userId} not found`);
      return [];
    }
    return this.resolveUserRoleSlugs(userId, user);
  }
}
