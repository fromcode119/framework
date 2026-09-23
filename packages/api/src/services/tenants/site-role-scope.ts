import { Schema } from '@fromcode119/database';
import { PluginTenantAccess, RequestContextUtils, StringUtils, SystemConstants, TenantMembership, TenantMembershipService, TenantMode } from '@fromcode119/core';

/**
 * Roles as ONE SITE sees them: which exist there, and which each member holds there.
 *
 * On a site a member is authorized by their MEMBERSHIP's roles (`AuthManager.useTenantRoles`), not by
 * the account's platform-wide grants. The site's Users screens read and wrote those platform-wide
 * grants instead — the list named roles that do nothing on the site (a plugin-free site showed
 * `partner` on its administrator), and "Manage roles" saved, said so, and changed nothing there.
 *
 * `current()` is `null` in the platform scope, where the platform-wide grants ARE the ones in question.
 */
export class SiteRoleScope {
  private constructor(
    private readonly db: any,
    private readonly tenantId: string,
    private readonly visible: Set<string>,
    private readonly memberships: Map<number, string[]>,
  ) {}

  /**
   * A site sees the framework's roles and its own plugins' roles, never another product's.
   *
   * `_system_roles` is global — plugins declare roles into it — so a site was shown roles belonging to
   * extensions it does not run. An UNATTRIBUTED role stays visible: nothing can honestly say who made a
   * role older than the `plugin_slug` column, and hiding `admin` for that reason is the worse failure.
   */
  static isVisibleOnSite(role: any, tenantId: string): boolean {
    const owner = String(role?.pluginSlug ?? '').trim();
    return !owner || owner === 'system' || PluginTenantAccess.enabledSlugsFor(tenantId).has(owner);
  }

  static async current(db: any): Promise<SiteRoleScope | null> {
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (!TenantMode.isEnabled() || !tenantId) return null;

    const [roles, rows] = await Promise.all([
      db.find(Schema.systemRoles),
      db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenantId } }),
    ]);
    const visible = new Set<string>((roles || [])
      .filter((role: any) => SiteRoleScope.isVisibleOnSite(role, tenantId))
      .map((role: any) => String(role?.slug ?? '')));
    const memberships = new Map<number, string[]>();
    for (const row of rows || []) {
      const membership = TenantMembership.from(row);
      if (membership.isActive) memberships.set(Number(membership.userId), membership.roles);
    }
    return new SiteRoleScope(db, tenantId, visible, memberships);
  }

  /**
   * Saves `roles` to the member's membership when a site is in scope, and says whether it did. `false`
   * in the platform scope, where the caller edits the platform-wide grants itself.
   */
  static async grantInCurrentSite(db: any, userId: number, roles: string[]): Promise<boolean> {
    const site = await SiteRoleScope.current(db);
    if (!site) return false;
    await site.grant(userId, roles);
    return true;
  }

  /** What this member holds HERE, minus roles owned by a plugin this site does not run. */
  rolesOf(userId: unknown): string[] {
    return (this.memberships.get(Number(userId)) ?? []).filter((slug) => this.visible.has(slug));
  }

  /** How many of this site's members hold `slug` here. */
  holdersOf(slug: string): number {
    return [...this.memberships.values()].filter((roles) => roles.includes(slug)).length;
  }

  /**
   * A role change made on a site is a change to the MEMBERSHIP. Roles the site is not shown cannot be
   * granted from it, and the account's platform-wide grants are not touched — a save used to replace
   * that whole list, so it could strip a grant the site had never been shown.
   */
  async grant(userId: number, submitted: string[]): Promise<void> {
    const granted = StringUtils.normalizeSlugList(submitted).filter((slug) => this.visible.has(slug));
    await new TenantMembershipService(this.db as never).grant(String(userId), this.tenantId, granted);
  }
}
