import { Request, Response, NextFunction } from 'express';
import { BaseMiddleware } from '@api/middlewares/base-middleware';
import { TenantMode } from '@fromcode119/core';

/**
 * Refuses a PLATFORM-INVENTORY read from a request that is scoped to one site.
 *
 * This is the SCOPE half of a rule whose other half is `PlatformAdminGuard`, and the two are not the
 * same question:
 *
 *   who is asking  — `PlatformAdminGuard`: is this account allowed to act on the shared container.
 *   where they are — this guard: is the request looking at the platform, or at one site.
 *
 * A platform admin passes the first and can still fail this one. That is deliberate: a tenant is
 * isolated from every other tenant, platform admin included, so once a site is bound to the request
 * the answer is that site's own assignment and never the catalogue of everything the platform has.
 * The catalogue is read in PLATFORM scope — the admin with no site selected — which is also where an
 * operator decides what each site gets.
 *
 * NOT applied to every platform route, and the difference is load-bearing. `/sites/:id` is a platform
 * surface an operator uses WHILE a site is selected — it is how a site's plugins, theme and
 * appearance are assigned at all — so gating it on scope would remove the only path by which a site
 * ever receives anything. This guard belongs on the INVENTORY listings, where the leak was: a
 * marketplace or catalogue enumerating the shared box to a request that is standing inside one
 * customer's site.
 *
 * Single-tenant deployments pass unconditionally — there is no second scope to be in.
 */
export class PlatformScopeGuard extends BaseMiddleware {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const tenantId = String((req as any).tenantId || '').trim();
    if (!TenantMode.isEnabled() || !tenantId) {
      next();
      return;
    }
    res.status(403).json({
      error: 'platform_scope_required',
      message: 'This lists what the whole platform has, so it is answered with no site selected. '
        + 'Leave the site to see it.',
    });
  }
}
