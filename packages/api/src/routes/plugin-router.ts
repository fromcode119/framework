import { BaseRouter } from '../routers/BaseRouter';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager } from '@fromcode119/core';
import { PluginController } from '../controllers/plugin-controller';

/**
 * Plugin management router.
 * 
 * Handles all plugin-related endpoints:
 * - Plugin listing and activation
 * - Configuration management
 * - Marketplace integration
 * - Upload and installation
 * 
 * @example
 * ```typescript
 * const pluginRouter = new PluginRouter(pluginManager, authManager);
 * app.use('/api/v1/plugins', pluginRouter.router);
 * ```
 */
export class PluginRouter extends BaseRouter {
  private controller: PluginController;
  private upload: multer.Multer;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new PluginController(manager);
    this.upload = multer({ dest: '/tmp/plugin-uploads' });
  }

  protected registerRoutes(): void {
    // Plugin listing and toggle
    this.get('/', this.auth.guard(['admin']), this.bind(this.controller.list));
    this.get('/active', this.bind(this.controller.active));
    this.post('/:slug/toggle', this.auth.guard(['admin']), this.bind(this.controller.toggle));
    
    // Configuration management
    this.get('/:slug/config', this.auth.guard(['admin']), this.bind(this.controller.getConfig));
    this.post('/:slug/config', this.auth.guard(['admin']), this.bind(this.controller.saveConfig));
    this.post('/:slug/sandbox', this.auth.guard(['admin']), this.bind(this.controller.saveSandboxConfig));
    
    // Plugin deletion
    this.delete('/:slug', this.auth.guard(['admin']), this.bind(this.controller.delete));
    
    // Marketplace and installation
    this.get('/marketplace', this.auth.guard(['admin']), this.bind(this.controller.marketplace));
    this.post('/install/:slug', this.auth.guard(['admin']), this.bind(this.controller.install));
    
    // Logging
    this.get('/:slug/logs', this.auth.guard(['admin']), this.bind(this.controller.logs));
    
    // Upload and inspect
    this.post('/upload/inspect', this.auth.guard(['admin']), this.upload.single('plugin'), 
      this.bind(this.controller.inspectUpload));
    this.post('/upload', this.auth.guard(['admin']), this.upload.single('plugin'), 
      this.bind(this.controller.upload));
  }
}

/**
 * Plugin asset serving router.
 * 
 * Serves plugin UI bundles and static assets.
 * 
 * @example
 * ```typescript
 * const assetRouter = new PluginAssetRouter(pluginManager);
 * app.use('/plugins', assetRouter.router);
 * ```
 */
export class PluginAssetRouter extends BaseRouter {
  private controller: PluginController;

  constructor(private manager: PluginManager) {
    super();
    this.controller = new PluginController(manager);
  }

  protected registerRoutes(): void {
    this.get('/:slug/ui/*', this.bind(this.controller.serveAssets));
  }
}

/**
 * Legacy setup function for backwards compatibility.
 * @deprecated Use PluginAssetRouter class instead - Will be removed in v2.0
 */
export function setupPluginAssetRoutes(manager: PluginManager) {
  console.warn('setupPluginAssetRoutes() is deprecated. Use PluginAssetRouter class instead.');
  return new PluginAssetRouter(manager).router;
}
