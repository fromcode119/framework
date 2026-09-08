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

    const token = AdminTenantResolver.tokenFrom(req);
    if (!token) return { tenant: null, reason: TenantResolutionRefusal.UNAUTHENTICATED };

    let claim: any;
    try {
      claim = await this.auth.verifyToken(token);
    } catch {
      return { tenant: null, reason: TenantResolutionRefusal.UNAUTHENTICATED };
    }

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
  private static tokenFrom(req: any): string {
    const cookies = req?.cookies ?? {};
    const fromParsed = String(cookies[CookieConstants.AUTH_TOKEN] || cookies[CookieConstants.CLIENT_AUTH_TOKEN] || '').trim();
    if (fromParsed) return fromParsed;

    // The tenant middleware runs before cookie-parser on some paths, so fall back to the raw header.
    const raw = String(req?.headers?.cookie || '');
    for (const part of raw.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === CookieConstants.AUTH_TOKEN || name === CookieConstants.CLIENT_AUTH_TOKEN) {
        return rest.join('=').trim();
      }
    }
    return '';
  }
}
