import { Request, Response } from 'express';
import { BaseController, CoercionUtils, CookieConstants, Logger, RequestContextUtils, SitePreviewGrantService } from '@fromcode119/core';
import { SitePreviewService } from '@api/services/tenants/site-preview-service';

/**
 * The two halves of letting a site's own people look at it before it is published.
 *
 * They live on OPPOSITE SIDES of a host boundary, which is the entire reason the feature has this
 * shape. `mint` is called by the admin console, on the console's host, with the operator's session.
 * `exchange` is called by the operator's BROWSER, on the site's own host, where that session does
 * not exist and never can — so the one-time token in the path is the only credential, and it is
 * checked against the table, against this site, and works once.
 */
export class SitePreviewController extends BaseController {
  private readonly logger = new Logger({ namespace: 'site-preview' });

  constructor(
    private readonly service: SitePreviewService,
    private readonly grants: SitePreviewGrantService,
  ) {
    super();
  }

  /** Admin surface: a link into one site. 403 covers "not yours" and "no such site" alike. */
  async mint(req: Request, res: Response): Promise<void> {
    const userId = CoercionUtils.toString((req as Request & { user?: { id?: unknown } }).user?.id);
    const url = await this.service.issueLink(
      CoercionUtils.toString(req.params.id),
      userId,
      SitePreviewController.schemeOf(req),
    );

    if (!url) {
      // One answer for every refusal. Distinguishing "no such site" from "not an administrator of
      // it" would let anyone holding the admin role enumerate which site ids exist on the platform.
      res.status(403).json({
        error: 'site_preview_refused',
        message: 'Previewing a site is for that site\'s own administrators and the platform owner.',
      });
      return;
    }

    res.json({ url });
  }

  /**
   * Storefront surface: spend the token, keep the cookie, land on the site.
   *
   * 303 EITHER WAY, with no reason given. On success the browser arrives at the home page already
   * carrying the session; on failure it arrives at the same place with no cookie and meets the
   * holding page, which is the honest answer — the site really is not published and this browser
   * really cannot see it. Saying which of expired/spent/wrong-site it was would describe somebody
   * else's link to whoever found it.
   */
  async exchange(req: Request, res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    const tenantId = CoercionUtils.toString(RequestContextUtils.getTenantId());
    const session = tenantId
      ? await this.grants.exchange(CoercionUtils.toString(req.params.token), tenantId)
      : '';

    // The visitor is told nothing, on purpose (above) — so the OPERATOR has to be told something.
    // A preview link that quietly lands on the holding page is indistinguishable from the feature
    // being broken, and the one place that knows which it was is here.
    if (!session) {
      this.logger.warn(
        `Preview link refused on site "${tenantId || '(no site resolved for this host)'}": the token is expired, `
        + 'already spent, or was minted for a different site.',
      );
    }

    if (session) {
      res.cookie(CookieConstants.SITE_PREVIEW, session, {
        httpOnly: true,
        // Only over the scheme this request actually used. A `secure` cookie on a plain-HTTP local
        // stack is silently dropped by the browser, which would make the whole feature look broken
        // in the one place it is developed.
        secure: SitePreviewController.schemeOf(req) === 'https',
        // LAX, not STRICT. The operator arrives here by a top-level navigation FROM the admin, which
        // is a different site; `strict` withholds the cookie on exactly that hop, so the redirect
        // below would land on the holding page every time. Lax sends it on top-level GETs and
        // withholds it from cross-site sub-requests, which is the distinction that matters.
        sameSite: 'lax',
        // No `domain`: host-scoped, like the admin session and for the same reason. This cookie is
        // about ONE site and must never be presented to another host on a shared parent domain.
        path: '/',
        maxAge: SitePreviewGrantService.SESSION_TTL_MS,
      });
    }

    res.redirect(303, '/');
  }

  /** The scheme this request actually reached the platform on, gateway included. */
  private static schemeOf(req: Request): string {
    const forwarded = CoercionUtils.toString(req.headers['x-forwarded-proto']).split(',')[0].trim().toLowerCase();
    return forwarded || String(req.protocol || '').toLowerCase();
  }
}
