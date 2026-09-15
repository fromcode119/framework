import { CookieConstants, TenantMembershipService, TenantRecord, TenantResolutionRefusal, TenantResolverService } from '@fromcode119/core';
import type { AuthManager } from '@fromcode119/auth';
import { WorkspaceHostService } from '@api/services/request/workspace-host-service';

/**
 * Which tenant an ADMIN request is acting in.
 *
 * The admin is one host serving many tenants, so the Host header cannot identify the tenant there —
 * that is why every admin call returned `404 unknown_host` before this existed. The storefront is
 * the opposite: its host IS the customer's site, and it keeps resolving by host.
 *
 * The tenant comes from the SIGNED token, not from anything the client can set. A header or query
 * parameter would let anyone with a session read any tenant by editing a string; the token's
 * `tenantId` claim is minted by us after checking membership and cannot be forged.
 *
 * The claim alone is not enough, though — it would keep working until the token expired after a
 * membership was revoked. So membership is re-checked on every request, and a revoked one is
 * refused immediately rather than at expiry.
 */
export class AdminTenantResolver {
  constructor(
    private readonly auth: AuthManager,
    private readonly tenants: TenantResolverService,
    private readonly memberships: TenantMembershipService,
    private readonly workspaceHosts: WorkspaceHostService,
  ) {}

  /**
   * Returns the tenant, or a reason it could not be resolved. `null` reasons are distinct on
   * purpose: "you have not chosen a tenant yet" is a prompt, not a 404, and the client must be able
   * to tell them apart.
   */
  async resolve(req: any): Promise<{ tenant: TenantRecord | null; reason?: TenantResolutionRefusal }> {
    // A WORKSPACE host names its tenant (T6): published on the request even for the login page,
    // which needs to know whose console it is before anyone is signed in.
    const workspace = await this.workspaceHosts.resolve(req);
    req.workspaceTenant = workspace;

    const claim = await this.newestValidClaim(AdminTenantResolver.tokensFrom(req));
    if (!claim) return { tenant: null, reason: TenantResolutionRefusal.UNAUTHENTICATED };

    const userId = String(claim?.id || '').trim();
    if (workspace) {
      // The host decides; the session's claim cannot move this request to another tenant. Membership
      // is still checked on every request, exactly as for the shared host.
      if (!(await this.memberships.hasAccess(userId, workspace.id))) {
        return { tenant: null, reason: TenantResolutionRefusal.TENANT_ACCESS_REVOKED };
      }
      return { tenant: workspace };
    }

    const tenantId = String(claim?.tenantId || '').trim();
    if (!tenantId) return { tenant: null, reason: TenantResolutionRefusal.NO_TENANT_SELECTED };

    if (!(await this.memberships.hasAccess(userId, tenantId))) {
      return { tenant: null, reason: TenantResolutionRefusal.TENANT_ACCESS_REVOKED };
    }

    const tenant = await this.tenants.resolveById(tenantId);
    if (!tenant) return { tenant: null, reason: TenantResolutionRefusal.UNKNOWN_TENANT };
    return { tenant };
  }

  /**
   * The SESSION COOKIE only — never the Authorization header.
   *
   * AuthManager deliberately ignores Bearer tokens in admin context (a frontend user token arriving
   * alongside the admin client header caused 403s). Reading Bearer here would let a token pick the
   * tenant that the auth layer then refuses to authenticate — two sources of truth disagreeing about
   * the same request. This uses the one the auth layer will actually accept.
   */
  /**
   * The NEWEST session the browser presented, not the first one it happened to send.
   *
   * A browser can hold two cookies of the same name at once — one host-scoped, one written to the
   * apex before admin sessions were narrowed to the host — and it sends BOTH. RFC 6265 orders them by
   * path length and then by AGE, so the STALE one arrives first, and reading "the first" read the
   * dead session on every request.
   *
   * That is what made switching site look like it silently did nothing: the switch really did mint a
   * token carrying the new tenant and really did write the session row, but the next request went on
   * presenting the old cookie, whose claim has no tenant. Nothing errored, because a stale token is
   * perfectly valid — it simply belongs to nobody's site. `clearCookieVariants` exists to delete the
   * apex copy, and `CSRFMiddleware` already reads every value for exactly this reason; the session
   * READ was the one path still assuming there is only ever one.
   *
   * `iat` decides, because the question "which of these sessions is the live one" has a factual
   * answer: the one minted most recently is the one the operator just established.
   */
  private async newestValidClaim(tokens: string[]): Promise<any | null> {
    let newest: any = null;
    for (const token of tokens) {
      try {
        const claim: any = await this.auth.verifyToken(token);
        if (!claim) continue;
        if (!newest || Number(claim.iat ?? 0) >= Number(newest.iat ?? 0)) newest = claim;
      } catch {
        // An expired or forged cookie sitting beside a good one must not deny the good one.
      }
    }
    return newest;
  }

  /** EVERY session cookie on the request, freshest-first order decided by the caller. */
  private static tokensFrom(req: any): string[] {
    const names: string[] = [CookieConstants.AUTH_TOKEN, CookieConstants.CLIENT_AUTH_TOKEN];
    const found: string[] = [];

    // The raw header FIRST, because it is the only place a duplicate survives: cookie-parser keeps
    // one value per name, so `req.cookies` cannot even represent the case this method exists for.
    const raw = String(req?.headers?.cookie || '');
    for (const part of raw.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (!names.includes(name)) continue;
      const value = rest.join('=').trim();
      if (value && !found.includes(value)) found.push(value);
    }

    // The tenant middleware runs before cookie-parser on some paths and after it on others.
    const cookies = req?.cookies ?? {};
    for (const name of names) {
      const value = String((cookies as Record<string, unknown>)[name] || '').trim();
      if (value && !found.includes(value)) found.push(value);
    }
    return found;
  }
}
