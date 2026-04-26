import { BaseRouter } from '../routers/base-router';
import { PluginManager } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';

/**
 * Marketplace routes for browsing and installing plugins.
 */
export class MarketplaceRouter extends BaseRouter {
  constructor(
    private manager: PluginManager,
    private auth: AuthManager
  ) {
    super();
  }

  protected registerRoutes(): void {
    this.use(this.auth.middleware());
    this.use(this.auth.guard(['admin']));

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
      const manifest = await this.manager.installOrUpdateFromMarketplace(req.params.slug);
      res.json({ success: true, manifest });
    }));
  }
}
