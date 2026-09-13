import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { SitePreviewController } from '@api/controllers/system/site-preview-controller';

/**
 * `/system/site-preview` — the handoff that lets a site's own people look at it before it is
 * published.
 *
 * TWO ROUTES WITH DELIBERATELY DIFFERENT GUARDS, which is why they are not on the Sites registry
 * router (that one is platform-admin from end to end, and rightly so).
 *
 * `POST /:id/session` is an admin-surface call and carries `auth.guard(['admin'])`. It is NOT
 * platform-admin-only: a customer's own administrator must be able to look at their own unpublished
 * site, and the service refuses any site they do not administer. That is a narrower rule than the
 * registry's, applied to one action rather than to the registry.
 *
 * `GET /exchange/:token` has NO guard, and cannot have one. It is requested by the operator's
 * browser on the SITE'S host, where the console's session cookie is not sent and on a customer's
 * apex domain never could be — the token in the path is the whole credential. It is single-use,
 * expires in a minute, and is refused unless it was minted for this exact site.
 */
export class SitePreviewRouter extends BaseRouter {
  constructor(
    private readonly controller: SitePreviewController,
    private readonly auth: AuthManager,
  ) {
    super();
  }

  protected registerRoutes(): void {
    const S = RouteConstants.SEGMENTS;
    // Registered BEFORE `/:id/session`, so a token is never read as a site id — the same ordering
    // the tenants router uses for "import" and "adopt".
    this.get(S.SITE_PREVIEW_EXCHANGE, this.controller.exchange);
    this.post(S.SITE_PREVIEW_SESSION, this.auth.guard(['admin']), this.controller.mint);
  }
}
