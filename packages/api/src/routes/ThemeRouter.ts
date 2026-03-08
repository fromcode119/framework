import { BaseRouter } from '../routers/BaseRouter';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { ThemeManager } from '@fromcode119/core';
import { ThemeController } from '../controllers/theme-controller';

/**
 * Theme management router.
 * 
 * Handles all theme-related endpoints:
 * - Theme listing and activation
 * - Configuration management
 * - Marketplace integration
 * - Upload and installation
 * 
 * @example
 * ```typescript
 * const themeRouter = new ThemeRouter(themeManager, authManager);
 * app.use('/api/v1/themes', themeRouter.router);
 * ```
 */
export class ThemeRouter extends BaseRouter {
  private controller: ThemeController;
  private upload: multer.Multer;

  constructor(
    private manager: ThemeManager,
    private auth: AuthManager
  ) {
    super();
    this.controller = new ThemeController(manager);
    this.upload = multer({ dest: '/tmp/theme-uploads' });
  }

  protected registerRoutes(): void {
    // Theme listing and management
    this.get('/', this.auth.guard(['admin']), this.bind(this.controller.list));
    this.get('/marketplace', this.auth.guard(['admin']), this.bind(this.controller.getMarketplace));
    this.get('/:slug/check-update', this.auth.guard(['admin']), this.bind(this.controller.checkUpdate));
    
    // Theme activation and reset
    this.get('/:slug/activate', this.auth.guard(['admin']), this.bind(this.controller.activate));
    this.post('/:slug/activate', this.auth.guard(['admin']), this.bind(this.controller.activate));
    this.post('/:slug/reset', this.auth.guard(['admin']), this.bind(this.controller.reset));
    
    // Installation
    this.post('/:slug/install', this.auth.guard(['admin']), this.bind(this.controller.install));
    
    // Upload and inspect
    this.post('/upload/inspect', this.auth.guard(['admin']), this.upload.single('theme'), 
      this.bind(this.controller.inspectUpload));
    this.post('/upload', this.auth.guard(['admin']), this.upload.single('theme'), 
      this.bind(this.controller.upload));
    
    // Configuration
    this.get('/:slug/config', this.auth.guard(['admin']), this.bind(this.controller.getConfig));
    this.post('/:slug/config', this.auth.guard(['admin']), this.bind(this.controller.saveConfig));
    
    // Theme deletion
    this.delete('/:slug', this.auth.guard(['admin']), this.bind(this.controller.delete));
  }
}

/**
 * Theme asset serving router.
 * 
 * Serves theme UI bundles and static assets.
 * 
 * @example
 * ```typescript
 * const assetRouter = new ThemeAssetRouter(themeManager);
 * app.use('/themes', assetRouter.router);
 * ```
 */
export class ThemeAssetRouter extends BaseRouter {
  private controller: ThemeController;

  constructor(private manager: ThemeManager) {
    super();
    this.controller = new ThemeController(manager);
  }

  protected registerRoutes(): void {
    this.get('/:slug/ui/*', this.bind(this.controller.serveAssets));
  }
}

/**
 * Legacy setup function for backwards compatibility.
 * @deprecated Use ThemeAssetRouter class instead - Will be removed in v2.0
 */
export function setupThemeAssetRoutes(manager: ThemeManager) {
  console.warn('setupThemeAssetRoutes() is deprecated. Use ThemeAssetRouter class instead.');
  return new ThemeAssetRouter(manager).router;
}
