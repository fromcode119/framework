import { TenantRecord } from '@core/tenant/tenant-record';

/**
 * One tenant an account may enter, and HOW it may enter it.
 *
 * The distinction is not cosmetic. A member is working in their own tenancy; a platform admin acting
 * on a tenant they are not a member of is working inside someone else's customer data. The operator
 * has to be able to see which of those is happening, on every screen, or the safeguard is only in
 * the audit log — after the mistake.
 *
 * A platform admin who is ALSO a member of a tenant enters that one as a member: the role only
 * explains the tenants membership does not.
 */
export class TenantAccess {
  readonly tenant: TenantRecord;

  /** True when this tenant is reachable only because the account is a platform admin. */
  readonly viaPlatformRole: boolean;

  private constructor(tenant: TenantRecord, viaPlatformRole: boolean) {
    this.tenant = tenant;
    this.viaPlatformRole = viaPlatformRole;
  }

  static member(tenant: TenantRecord): TenantAccess {
    return new TenantAccess(tenant, false);
  }

  static platform(tenant: TenantRecord): TenantAccess {
    return new TenantAccess(tenant, true);
  }

  get id(): string {
    return this.tenant.id;
  }
}
