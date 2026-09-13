import { Logger } from '@fromcode119/core';
import { SiteVisibilityGate } from '@api/server/site-visibility-gate';

/**
 * Refuses a site that is not open yet, to everyone but the people building it.
 *
 * MOUNTED IMMEDIATELY AFTER THE AUTH MIDDLEWARE, which is the whole point of it being its own step.
 * The question needs both halves — which site (bound by tenant resolution, which must run FIRST
 * because auth verifies the token's tenant claim) and who is asking (established by auth) — and this
 * is the first moment in the chain where both exist. It used to be asked during tenant resolution,
 * where `req.user` was always empty, so the admin bypass the gate has always contained never ran
 * once and a site's own administrator was refused along with every stranger.
 *
 * STOREFRONT ONLY. The admin console must never be gated on the visibility of the site it is
 * editing: that is the surface the site is BUILT on, and closing it would take away the only place
 * the visibility can be changed back. A request with no tenant bound — a single-tenant deployment, a
 * probe, the internal surface — has no site to be private and passes untouched.
 */
export class SiteVisibilityMiddleware {
  private static readonly STOREFRONT = 'storefront';

  constructor(private readonly gate: SiteVisibilityGate, private readonly logger: Logger) {}

  /** The Express handler. Bound on construction so it can be passed straight to `app.use`. */
  middleware() {
    return (req: any, res: any, next: any): void => { void this.handle(req, res, next); };
  }

  private async handle(req: any, res: any, next: any): Promise<void> {
    const tenant = req?.tenant;
    if (!tenant || req?.tenantSurface !== SiteVisibilityMiddleware.STOREFRONT) {
      next();
      return;
    }

    try {
      if (await this.gate.allows(tenant, req)) {
        next();
        return;
      }
    } catch (error: unknown) {
      // Fail CLOSED. This exists to keep an unpublished site closed; a lookup that threw is not a
      // reason to open one, and the operator's own preview is one retry away.
      this.logger.error(`Site visibility check failed for tenant "${tenant.id}"`, error);
    }

    SiteVisibilityMiddleware.refuse(req, res);
  }

  /**
   * 503, not 404: the site exists and will be there later, and a 404 with a body tells a crawler the
   * address is wrong. `no-store` because this answer changes the moment somebody presses Publish.
   */
  private static refuse(req: any, res: any): void {
    res.status(503)
      .set('Retry-After', '3600')
      .set('Cache-Control', 'no-store')
      .set('X-Robots-Tag', 'noindex, nofollow')
      .json({ error: 'site_private', host: String(req?.headers?.host || '') });
  }
}
