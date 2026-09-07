import { CoercionUtils } from '@core/coercion-utils';

/**
 * One account's access to one tenant.
 *
 * Identity is the "Google model": `users` holds a single global account, and access to a tenant is
 * a membership row. A user created in a tenant gets exactly one; granting them a second tenant adds
 * a row rather than duplicating the account, so there is still one password and one profile.
 *
 * This is also what the `users` row-level-security policy reads — an account is visible in a tenant
 * only while an ACTIVE membership exists for it.
 */
export class TenantMembership {
  private static readonly ACTIVE = 'active';

  readonly userId: string;
  readonly tenantId: string;
  readonly roles: string[];
  readonly state: string;

  private constructor(input: { userId: string; tenantId: string; roles: string[]; state: string }) {
    this.userId = input.userId;
    this.tenantId = input.tenantId;
    this.roles = input.roles;
    this.state = input.state;
  }

  get isActive(): boolean {
    return this.state === TenantMembership.ACTIVE;
  }

  /**
   * Hydrates from a RAW framework row. `_system_tenant_memberships` is a system table read through
   * the raw database manager, which does not denormalize — so these are the real snake_case column
   * names. One canonical name, never a camel/snake dual read.
   */
  static from(row: Record<string, unknown>): TenantMembership {
    const userId = CoercionUtils.toString(row?.user_id);
    if (!userId) {
      throw new Error('TenantMembership.from: row has no user_id; refusing to build a membership with no account.');
    }
    const tenantId = CoercionUtils.toString(row?.tenant_id);
    if (!tenantId) {
      throw new Error('TenantMembership.from: row has no tenant_id; refusing to build a membership with no tenant.');
    }
    return new TenantMembership({
      userId,
      tenantId,
      roles: TenantMembership.parseRoles(row?.roles),
      state: CoercionUtils.toString(row?.state),
    });
  }

  /**
   * A malformed role list yields NO roles, never all roles. Failing open here would hand a member
   * whatever permissions the caller happened to check for.
   */
  private static parseRoles(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((entry) => CoercionUtils.toString(entry));
    const raw = CoercionUtils.toString(value);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => CoercionUtils.toString(entry));
    } catch {
      return [];
    }
  }
}
