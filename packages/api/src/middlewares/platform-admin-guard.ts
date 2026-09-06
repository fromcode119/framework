import { Request, Response, NextFunction } from 'express';
import { BaseMiddleware } from '@api/middlewares/base-middleware';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';

/**
 * Refuses a PLATFORM action from anyone who is not a platform admin.
 *
 * Installing, updating or deleting a plugin or theme, activating a theme, changing a plugin's
 * sandbox or platform config, reading the marketplace — each of these acts on the ONE container that
 * every customer runs on. Before this guard they were gated on the `admin` role alone, and on a
 * multi-tenant deployment a tenant's own administrator holds that role. So a customer could put
 * arbitrary code on the shared box, remove a plugin every other customer relied on, or switch the
 * storefront theme under all of them. That is the trust boundary the whole tenancy program exists
 * to draw, and it was open.
 *
 * Runs AFTER `auth.guard(['admin'])`, which has already established `req.user`. On a single-tenant
 * deployment it passes everyone that guard passed — there, the admin is the platform.
 */
export class PlatformAdminGuard extends BaseMiddleware {
  constructor(private readonly access: PlatformAccessResolver) {
    super();
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (await this.access.isPlatformAdmin(req)) {
      next();
      return;
    }
    res.status(403).json({
      error: 'platform_admin_required',
      message: 'This changes the platform every site runs on, and only a platform admin may do that.',
    });
  }
}
