import { BaseRouter } from '@fromcode119/core';
import { PluginManager } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * Marketplace routes for browsing and installing plugins.
 */
export class MarketplaceRouter extends BaseRouter {
  constructor(
    private manager: PluginManager,
    private auth: AuthManager,
    private platformAdmin: PlatformAdminGuard,
  ) {
    super();
  }

  protected registerRoutes(): void {
    this.use(this.auth.middleware());
    this.use(this.auth.guard(['admin']));
    // Every route here is a PLATFORM action: browsing the catalogue exposes what the operator has
    // available across all customers, and `install` puts code on the container every customer runs
    // on. `admin` alone is a tenant's own administrator on a multi-tenant deployment — not enough.
    this.use(this.platformAdmin.middleware());

    this.get('/plugins', this.asyncHandler(async (_req, res) => {
      const plugins = await this.manager.marketplace.fetchCatalog();
      res.json({ plugins });
    }));

    this.get('/plugins/:slug', this.asyncHandler(async (req, res) => {
      const plugin = await this.manager.marketplace.getPluginInfo(req.params.slug);
      if (!plugin) { res.status(404).json({ error: 'Plugin not found' }); return; }
      res.json(plugin);
    }));

    this.post('/install/:slug', this.asyncHandler(async (req, res) => {
      const requestedVersion = String(req.query.version || '').trim();
      const manifest = await this.manager.installOrUpdateFromMarketplace(req.params.slug, {
        version: requestedVersion || undefined,
      });
      res.json({ success: true, manifest });
    }));
  }
}
