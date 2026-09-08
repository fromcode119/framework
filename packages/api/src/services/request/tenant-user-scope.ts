import { RequestContextUtils, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';

/**
 * Which user accounts this request may see and act on.
 *
 * `users` is the identity table and cannot be tenant-scoped by row-level security: login has to find
 * an account BEFORE any tenant is known, so a policy there would lock everyone out (see the tenancy
 * program's notes on the resolution path). The scope therefore has to be applied by the code that
 * serves the admin — and it was not applied at all: Users listed every account on the platform, and
 * `GET/PUT /admin/users/:id` accepted any id, so one site's administrator could read and edit
 * another customer's accounts by number.
 *
 * A site's users are its MEMBERS. A platform admin, and any single-tenant deployment, see everyone —
 * `null` says exactly that, and is never confused with "an empty site".
 */
export class TenantUserScope {
  private constructor(private readonly memberIds: Set<number> | null) {}

  static async of(req: unknown, db: unknown): Promise<TenantUserScope> {
    if (!TenantMode.isEnabled()) return new TenantUserScope(null);
    if (await new PlatformAccessResolver(db).isPlatformAdmin(req)) return new TenantUserScope(null);

    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    // No site in scope: a request that is not acting for any site may act on no account. Returning
    // "everyone" here is how a missing tenant would silently become full access.
    if (!tenantId) return new TenantUserScope(new Set<number>());

    const ids = await new TenantMembershipService(db as never).listUserIdsForTenant(tenantId);
    return new TenantUserScope(new Set(ids));
  }

  /** `null` = unrestricted. Otherwise the only ids this request may see. */
  get ids(): number[] | null {
    return this.memberIds ? [...this.memberIds] : null;
  }

  allows(userId: number): boolean {
    return this.memberIds ? this.memberIds.has(userId) : true;
  }
}
