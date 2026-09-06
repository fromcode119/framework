import { Request, Response, NextFunction } from 'express';
import { PluginTenantAccess, TenantMode } from '@fromcode119/core';
import { BaseMiddleware } from '@api/middlewares/base-middleware';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';

/**
 * A tenant configures the plugins it RUNS, and no others.
 *
 * Plugin settings are per tenant (T2), so a tenant admin must keep access to them — that is not a
 * platform action. But `/plugins/:slug/settings` was reachable for EVERY installed plugin, including
 * ones this site does not run. Reading another product's settings schema, or writing settings for a
 * plugin that will never read them, is the platform catalogue leaking through a side door.
 *
 * A platform admin passes for any slug, because it is acting on the tenant it has selected in the
 * header and may need to configure a plugin before switching it on there.
 */
export class TenantPluginGuard extends BaseMiddleware {
  constructor(private readonly access: PlatformAccessResolver) {
    super();
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!TenantMode.isEnabled()) {
      next();
      return;
    }

    const slug = String(req.params?.slug ?? '').trim();
    if (PluginTenantAccess.isEnabledForCurrentTenant(slug) || await this.access.isPlatformAdmin(req)) {
      next();
      return;
    }

    res.status(403).json({
      error: 'plugin_not_enabled_for_tenant',
      message: `Plugin "${slug}" is not enabled for this site.`,
    });
  }
}
