import { ApiPathUtils, SitePreviewGrantService, SystemConstants, TenantMembershipService, TenantRecord, TenantResolverService } from '@fromcode119/core';

/**
 * Handing one of a site's own people a link that lets them look at it before it is published.
 *
 * The whole reason this exists as a link rather than a permission check is that the two hosts cannot
 * share a credential. The admin console sets its session cookie HOST-SCOPED on purpose — a shared
 * cookie domain produced a "Token tenant mismatch" bug and was fixed by narrowing it — so the
 * console's session is never presented on the site's own domain, and on a customer's apex domain
 * there is no shared domain to widen it to. A one-time token in a URL is the one thing that crosses.
 *
 * WHO MAY ASK: a platform admin, or an administrator OF THIS SITE. Not "anyone holding the admin
 * role", which on a multi-site platform is every customer's own administrator — that is the same
 * mistake the maintenance gate makes, and it would hand each of them a link into everybody else's
 * unpublished site.
 */
export class SitePreviewService {
  constructor(
    private readonly tenants: TenantResolverService,
    private readonly grants: SitePreviewGrantService,
    private readonly memberships: TenantMembershipService,
  ) {}

  /**
   * A link that opens this site for whoever follows it, once.
   *
   * Returns '' when the caller may not ask, when the site does not exist, or when it has no host to
   * send them to. The caller turns that into a 403/404 — the decision is not made here, but the
   * refusal is, so there is one place that knows the rule.
   */
  async issueLink(tenantId: string, userId: string, scheme: string): Promise<string> {
    const site = await this.tenants.resolveById(String(tenantId ?? '').trim());
    if (!site) return '';
    if (!(await this.mayPreview(site, userId))) return '';

    const host = String(site.primaryHost ?? '').trim().toLowerCase();
    // No host means nothing to open. Never a guessed one: sending an operator to an address the
    // platform does not serve is worse than telling them the site has no address yet.
    if (!host) return '';

    const token = await this.grants.issue(site.id, userId);
    const path = ApiPathUtils.versioned(
      ApiPathUtils.fillPath(SystemConstants.API_PATH.SYSTEM.SITE_PREVIEW_EXCHANGE, { token }),
    );
    return `${SitePreviewService.normalizeScheme(scheme)}://${host}${path}`;
  }

  /** Platform admin, or an administrator of this specific site. Nothing else. */
  private async mayPreview(site: TenantRecord, userId: string): Promise<boolean> {
    const account = String(userId ?? '').trim();
    if (!account) return false;
    if (await this.memberships.isPlatformAdminAccount(account)) return true;
    const roles = await this.memberships.rolesForTenant(account, site.id);
    return Array.isArray(roles) && roles.includes('admin');
  }

  /**
   * The scheme the link uses.
   *
   * Taken from the request the operator is already making, rather than assumed: a local stack serves
   * both the console and the sites over plain HTTP, and a hardcoded `https` there produces a link
   * that cannot connect. Anything that is not exactly `http` is treated as `https`.
   */
  private static normalizeScheme(scheme: unknown): string {
    return String(scheme ?? '').trim().toLowerCase() === 'http' ? 'http' : 'https';
  }
}
