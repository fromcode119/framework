import { SystemConstants } from '@core/constants/system.constants';
import { TenantMembership } from '@core/tenant/tenant-membership';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantAccess } from '@core/tenant/tenant-access';
import { CoercionUtils } from '@core/coercion-utils';

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
