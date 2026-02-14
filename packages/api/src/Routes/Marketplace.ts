import express from 'express';
import { PluginManager } from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';

export const setupMarketplaceRoutes = (manager: PluginManager, auth: AuthManager) => {
  const router = express.Router();

  // Middleware to ensure user is admin
  const adminOnly = (req: any, res: any, next: any) => {
    if (!req.user || !req.user.roles || !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  router.use(auth.middleware());
  router.use(adminOnly);

  // GET /api/v1/marketplace/plugins
  router.get('/plugins', async (req, res) => {
    try {
      const plugins = await manager.marketplace.fetchCatalog();
      res.json({ plugins });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v1/marketplace/plugins/:slug
  router.get('/plugins/:slug', async (req, res) => {
    try {
      const plugin = await manager.marketplace.getPluginInfo(req.params.slug);
      if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
      res.json(plugin);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v1/marketplace/install/:slug
  router.post('/install/:slug', async (req, res) => {
    try {
      const manifest = await manager.marketplace.downloadAndInstall(req.params.slug);
      
      // Perform discovery to load the new plugin
      await manager.discoverPlugins();
      
      res.json({ success: true, manifest });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
