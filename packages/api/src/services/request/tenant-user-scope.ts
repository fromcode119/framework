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
  private constructor(
    private readonly memberIds: Set<number> | null,
    // Members whose ACCOUNT this site does not own alone (see `mayEditIdentity`). Empty outside a site,
    // and for a platform admin: the platform stands above every site.
    private readonly sharedIds: Set<number> = new Set(),
    // The site this scope is for, or null in platform scope / single-tenant.
    private readonly siteId: string | null = null,
  ) {}

  static async of(req: unknown, db: unknown): Promise<TenantUserScope> {
    if (!TenantMode.isEnabled()) return new TenantUserScope(null);

    // THE SITE IS ASKED FIRST, AND IT WINS.
    //
    // The platform-admin check used to run ahead of this and answered `null` — unrestricted — which
    // meant an operator with a site selected read, edited and deleted every account on the platform
    // from inside that site's console. Measured before this change: site "initech", one member, 30
    // accounts returned, including other customers' people.
    //
    // A tenant is isolated from every other tenant, platform admin included. Being entitled to act on
    // the platform is not the same as acting on it — that is done in PLATFORM scope, with no site
    // selected, which is the branch below.
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (tenantId) {
      const memberships = new TenantMembershipService(db as never);
      const ids = await memberships.listUserIdsForTenant(tenantId);
      const shared = await new PlatformAccessResolver(db).isPlatformAdmin(req)
        ? []
        : await memberships.listSharedUserIds(tenantId, ids);
      return new TenantUserScope(new Set(ids), new Set(shared), tenantId);
    }

    // No site bound. A platform admin is the platform and sees everyone; anyone else acting for no
    // site may act on no account — returning "everyone" here is how a missing tenant would silently
    // become full access.
    if (await new PlatformAccessResolver(db).isPlatformAdmin(req)) return new TenantUserScope(null);
    return new TenantUserScope(new Set<number>());
  }

  /** `null` = unrestricted. Otherwise the only ids this request may see. */
  get ids(): number[] | null {
    return this.memberIds ? [...this.memberIds] : null;
  }

  allows(userId: number): boolean {
    return this.memberIds ? this.memberIds.has(userId) : true;
  }

  /**
   * May this request change the ACCOUNT itself — email, username, name, password — or delete it?
   *
   * Seeing a member is not owning their account. `users` is one table for the whole platform: an
   * account that is also a member of another site, or is the platform admin, signs in with the same
   * email and password everywhere, so a site that could rewrite them could sign in as that account on
   * every other site. Measured before this rule: a site's administrator could set the platform admin's
   * password, because the platform admin was a member of that site. Such an account's identity is
   * changed in platform scope, by a platform admin; a site changes only its own membership.
   */
  mayEditIdentity(userId: number): boolean {
    return this.allows(userId) && !this.sharedIds.has(userId);
  }

  /**
   * May this request see or end this session? A session carries the site it was opened on: inside a
   * site only that site's own sessions count, so a site cannot read where else its members are signed
   * in, nor sign them out of another site.
   */
  allowsSession(userId: unknown, tenantId: unknown): boolean {
    if (!this.allows(Number(userId))) return false;
    return this.siteId === null || String(tenantId ?? '') === this.siteId;
  }
}
