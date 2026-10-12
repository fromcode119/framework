import type { Request } from 'express';
import { CookieConstants, SitePreviewGrantService, TenantMembershipService } from '@fromcode119/core';

/**
 * WHO is looking through a site's preview session, for reading that site's unpublished content.
 *
 * The admin's Preview of a draft opens on the site's own host, where the console session is never
 * sent (it is host-scoped on purpose). Draft visibility is decided by an IDENTITY — every collection
 * read asks what the user may see — so a yes/no "this browser holds a preview session" is not enough:
 * the read still runs as nobody and the draft stays hidden. The session was minted for one person
 * (`SitePreviewService.mayPreview`: a platform admin or an administrator of this site), so it stands
 * for that person here, re-checked on every request — a demoted administrator's two-hour session
 * stops opening drafts at once.
 *
 * It is used for content RESOLUTION only, and grants nothing the person could not already do while
 * signed in to the console: it never authenticates a write, and nothing else on the request sees it.
 */
export class SitePreviewViewer {
  private static readonly ADMIN_ROLE = 'admin';

  constructor(private readonly db: unknown) {}

  /** The preview session's owner as a read principal, or null when there is none or they no longer qualify. */
  async of(tenantId: string, req: Request): Promise<{ id: string; roles: string[]; permissions: string[] } | null> {
    const cookie = (req as Request & { cookies?: Record<string, unknown> }).cookies?.[CookieConstants.SITE_PREVIEW];
    if (!cookie || !tenantId) return null;

    const grant = await new SitePreviewGrantService(this.db).verifySession(cookie, tenantId);
    if (!grant) return null;

    const memberships = new TenantMembershipService(this.db as never);
    const isPlatformAdmin = await memberships.isPlatformAdminAccount(grant.userId);
    const siteRoles = isPlatformAdmin ? null : await memberships.rolesForTenant(grant.userId, tenantId);
    if (!isPlatformAdmin && !(siteRoles ?? []).includes(SitePreviewViewer.ADMIN_ROLE)) return null;

    return { id: grant.userId, roles: [SitePreviewViewer.ADMIN_ROLE], permissions: [] };
  }
}
