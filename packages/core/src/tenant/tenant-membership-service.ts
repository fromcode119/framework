import { SystemConstants } from '@core/constants/system.constants';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantAccess } from '@core/tenant/tenant-access';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { RoleCatalog } from '@core/tenant/role-catalog';
import { TenantMode } from '@core/tenant/tenant-mode';

/**
 * Which tenants an account may enter.
 *
 * Framework-owned: memberships and tenants are system tables, read through the raw database manager
 * (so snake_case column names — the raw manager does not denormalize). No plugin reads either.
 *
 * A PLATFORM ADMIN is not a member of anything: the role sits on the account and grants access to
 * every active tenant. That is what makes support and provisioning possible, and it is why every
 * platform-admin action is audited with the tenant it touched.
 */
export class TenantMembershipService {
  /** The membership role that makes an account staff for that site. */
  private static readonly ADMIN_ROLE = 'admin';

  constructor(private readonly db: any) {}

  /**
   * Every tenant this account may enter, and how.
   *
   * A platform admin gets every active tenant, but the ones it is genuinely a MEMBER of come back
   * marked as membership — the role only explains the rest. The caller needs that difference to show
   * the operator when it is working inside a customer it does not belong to.
   */
  async listForUser(userId: string): Promise<TenantAccess[]> {
    const id = CoercionUtils.toString(userId);
    if (!id) return [];

    const memberTenantIds = await this.activeMembershipTenantIds(id);

    if (await this.isPlatformAdmin(id)) {
      const rows = await this.db.find(SystemConstants.TABLE.TENANTS, {});
      return (rows ?? [])
        .map((row: any) => TenantRecord.from(row))
        .filter((tenant: TenantRecord) => tenant.isActive)
        .map((tenant: TenantRecord) => memberTenantIds.includes(tenant.id)
          ? TenantAccess.member(tenant)
          : TenantAccess.platform(tenant));
    }

    if (memberTenantIds.length === 0) return [];

    const tenants = await this.db.find(SystemConstants.TABLE.TENANTS, {});
    return (tenants ?? [])
      .map((row: any) => TenantRecord.from(row))
      .filter((tenant: TenantRecord) => tenant.isActive && memberTenantIds.includes(tenant.id))
      .map((tenant: TenantRecord) => TenantAccess.member(tenant));
  }

  /**
   * The sites this account may ADMINISTER — what the admin console offers in its switcher.
   *
   * Not the same question as `listForUser`, which is every site the account belongs to. Someone can be
   * an administrator of one site and a customer of another; offering the second in an admin console is
   * a dead end, because being a customer there grants nothing to administer. Their relationship with
   * that site is a storefront one and belongs on its account page.
   *
   * A platform admin still gets every active site: that reach is the point of the role. "Administer"
   * means "open the console": a membership counts when one of its roles does ({@link consoleRoleSlugs}).
   */
  async listAdministeredByUser(userId: string): Promise<TenantAccess[]> {
    const id = CoercionUtils.toString(userId);
    if (!id) return [];
    if (await this.isPlatformAdmin(id)) return this.listForUser(id);

    const rows = await this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { user_id: id } });
    const administered: string[] = [];
    for (const membership of (rows ?? []).map((row: any) => TenantMembership.from(row))) {
      if (!membership.isActive) continue;
      const consoleRoles = await this.consoleRoleSlugs(membership.tenantId);
      if (membership.roles.some((role) => consoleRoles.has(role))) administered.push(membership.tenantId);
    }
    if (administered.length === 0) return [];

    const tenants = await this.db.find(SystemConstants.TABLE.TENANTS, {});
    return (tenants ?? [])
      .map((row: any) => TenantRecord.from(row))
      .filter((tenant: TenantRecord) => tenant.isActive && administered.includes(tenant.id))
      .map((tenant: TenantRecord) => TenantAccess.member(tenant));
  }

  /**
   * The roles that open a site's console: `admin`, and any role that carries at least one permission.
   *
   * Only `admin` used to count, so an employee given a scoped role — a site editor, a staff member
   * who keeps their own schedule — signed in to "No site access", and on the site's own console host
   * was refused outright. A role with no permissions (customer, partner) still opens nothing: there is
   * nothing in a console it could do.
   */
  private async consoleRoleSlugs(tenantId: string): Promise<Set<string>> {
    // The platform's roles AND this site's own: a site's staff role is what opens its console.
    const roles = await new RoleCatalog(this.db).list(tenantId);
    const slugs = new Set<string>([TenantMembershipService.ADMIN_ROLE]);
    for (const role of roles) {
      if (role.permissions.length > 0) slugs.add(role.slug.trim().toLowerCase());
    }
    return slugs;
  }

  /**
   * The user ids holding an ACTIVE membership of this tenant — a site's people.
   *
   * `users` cannot be tenant-scoped by policy (login must find an account before a tenant exists), so
   * this is what the admin's user surfaces filter by instead.
   */
  async listUserIdsForTenant(tenantId: string): Promise<number[]> {
    const tenant = CoercionUtils.toString(tenantId);
    if (!tenant) return [];
    const rows = await this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { tenant_id: tenant } });
    return (rows ?? [])
      .map((row: any) => TenantMembership.from(row))
      .filter((membership: TenantMembership) => membership.isActive)
      .map((membership: TenantMembership) => Number(membership.userId))
      .filter((id: number) => Number.isFinite(id));
  }

  /**
   * Of `userIds` — members of `tenantId` — the accounts this site does NOT own alone: those holding a
   * membership row of any OTHER site (in any state), and the platform admin.
   *
   * `users` is one table for the whole platform, so an account's email and password are the same
   * account on every site it belongs to. A site that could rewrite them could sign in as that account
   * everywhere else — as the platform admin, when the platform admin is a member. What a site may
   * change on such an account is its own membership; the identity belongs to the platform.
   */
  async listSharedUserIds(tenantId: string, userIds: number[]): Promise<number[]> {
    const tenant = CoercionUtils.toString(tenantId);
    const ids = userIds.map((id) => CoercionUtils.toString(id)).filter(Boolean);
    if (!tenant || ids.length === 0) return [];
    const [memberships, owners] = await Promise.all([
      this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { user_id: { in: ids } } }),
      this.db.find(SystemConstants.TABLE.USERS, { where: { is_platform_admin: true } }),
    ]);
    const shared = new Set<string>();
    for (const row of memberships ?? []) {
      const membership = TenantMembership.from(row);
      if (membership.tenantId !== tenant) shared.add(CoercionUtils.toString(membership.userId));
    }
    for (const row of owners ?? []) shared.add(CoercionUtils.toString((row as any).id));
    return ids.filter((id) => shared.has(id)).map(Number).filter((id) => Number.isFinite(id));
  }

  /** Tenant ids this account holds an ACTIVE membership row for. */
  private async activeMembershipTenantIds(userId: string): Promise<string[]> {
    const memberships = await this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, {
      where: { user_id: userId },
    });
    return (memberships ?? [])
      .map((row: any) => TenantMembership.from(row))
      .filter((membership: TenantMembership) => membership.isActive)
      .map((membership: TenantMembership) => membership.tenantId);
  }

  /**
   * May this account enter this tenant RIGHT NOW?
   *
   * Re-checked on every request rather than trusted from the token, so revoking a membership takes
   * effect immediately instead of when the token happens to expire.
   */
  async hasAccess(userId: string, tenantId: string): Promise<boolean> {
    const id = CoercionUtils.toString(userId);
    const tenant = CoercionUtils.toString(tenantId);
    if (!id || !tenant) return false;

    if (await this.isPlatformAdmin(id)) return true;

    const row = await this.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, {
      user_id: id, tenant_id: tenant,
    });
    if (!row) return false;
    return TenantMembership.from(row).isActive;
  }

  async grant(userId: string, tenantId: string, roles: string[] = []): Promise<void> {
    const existing = await this.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, {
      user_id: CoercionUtils.toString(userId), tenant_id: CoercionUtils.toString(tenantId),
    });
    if (existing) {
      await this.db.update(
        SystemConstants.TABLE.TENANT_MEMBERSHIPS,
        { user_id: CoercionUtils.toString(userId), tenant_id: CoercionUtils.toString(tenantId) },
        { state: 'active', roles: JSON.stringify(roles) },
      );
      return;
    }
    await this.db.insert(SystemConstants.TABLE.TENANT_MEMBERSHIPS, {
      user_id: CoercionUtils.toString(userId),
      tenant_id: CoercionUtils.toString(tenantId),
      roles: JSON.stringify(roles),
      state: 'active',
    });
  }

  /** Removes one membership. The account and its other memberships are untouched. */
  async revoke(userId: string, tenantId: string): Promise<void> {
    await this.db.delete(SystemConstants.TABLE.TENANT_MEMBERSHIPS, {
      user_id: CoercionUtils.toString(userId), tenant_id: CoercionUtils.toString(tenantId),
    });
  }

  /**
   * Is this account a platform admin?
   *
   * Public because callers outside tenancy need it: the platform axis of plugin enablement
   * (installed / loadable / held) is an operator-wide fact, so changing it is a platform-admin
   * action and the controller has to be able to ask.
   */
  /**
   * What this account may do ON THIS SITE, or `null` when the question does not apply.
   *
   * `null` for a platform admin (their reach is the platform, not one membership) and for an account
   * with no active membership here (other gates decide whether it may be present at all). Anything else
   * returns the membership's own roles — which is what makes "customer on one site, administrator on
   * another" a real distinction rather than a stored value nothing reads.
   */
  async rolesForTenant(userId: string, tenantId: string): Promise<string[] | null> {
    const id = CoercionUtils.toString(userId);
    const tenant = CoercionUtils.toString(tenantId);
    if (!id || !tenant) return null;
    if (await this.isPlatformAdmin(id)) return null;

    const row = await this.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: id, tenant_id: tenant });
    if (!row) return null;
    const membership = TenantMembership.from(row);
    if (!membership.isActive) return null;
    return membership.roles;
  }

  /**
   * What this account may do in PLATFORM scope — with no site bound — or `null` for "keep its global
   * roles".
   *
   * `null` on a single-site deployment, where every admin is the platform, and for the platform admin,
   * whose reach the platform is. Anyone else holds NOTHING there: a global `admin` role on a multi-site
   * deployment is not platform administration, and platform scope is exactly where platform-level
   * screens live. Such an account still signs in and picks a site; what it may do is then decided by
   * that site's membership.
   */
  async rolesOutsideSite(userId: string): Promise<string[] | null> {
    if (!TenantMode.isEnabled()) return null;
    const id = CoercionUtils.toString(userId);
    if (id && await this.isPlatformAdmin(id)) return null;
    return [];
  }

  /**
   * Does this account administer ANY site?
   *
   * The admin app's own gate is a chicken-and-egg otherwise: it admits staff by GLOBAL role, but a site
   * administrator's `admin` role lives on the membership, and no site is in scope until you are already
   * inside and have picked one. So an account that is a customer globally and an administrator of one
   * site was refused at the door — correctly, by a rule that could not see the membership.
   *
   * This answers the entry question only. What the account may actually DO once inside is still decided
   * per site by `rolesForTenant`, so an admin of one site is not an admin of another.
   */
  async administersAnyTenant(userId: string): Promise<boolean> {
    const id = CoercionUtils.toString(userId);
    if (!id) return false;
    if (await this.isPlatformAdmin(id)) return true;

    const rows = await this.db.find(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { where: { user_id: id } });
    return (rows ?? []).some((row: any) => {
      const membership = TenantMembership.from(row);
      return membership.isActive && membership.roles.includes(TenantMembershipService.ADMIN_ROLE);
    });
  }

  async isPlatformAdminAccount(userId: string): Promise<boolean> {
    const id = CoercionUtils.toString(userId);
    if (!id) return false;
    return this.isPlatformAdmin(id);
  }

  private async isPlatformAdmin(userId: string): Promise<boolean> {
    const user = await this.db.findOne(SystemConstants.TABLE.USERS, { id: userId });
    // snake_case: this is the RAW manager, which does not denormalize. One canonical name.
    return user?.is_platform_admin === true;
  }
}
