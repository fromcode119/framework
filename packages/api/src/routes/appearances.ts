import { BaseRouter } from '../routers/base-router';
import { AuthManager } from '@fromcode119/auth';
import { AppearanceManager, Logger, RouteConstants } from '@fromcode119/core';

const { APPEARANCES_CATALOG, APPEARANCES_INSTALL, APPEARANCES_SLUG } = RouteConstants.SEGMENTS;

/**
 * Admin appearance management — a SETTINGS concern, deliberately separate from the plugin/theme
 * marketplace. Lists available appearances (built-in default + those in the appearances dir),
 * installs one from a URL/zip, and removes one. The ACTIVE appearance is the `admin_appearance`
 * system setting (switched via the settings UI), not handled here.
 */
export class AppearanceRouter extends BaseRouter {
  private readonly manager: AppearanceManager;

  constructor(private readonly auth: AuthManager) {
    super();
    this.manager = new AppearanceManager(new Logger({ namespace: 'appearance' }));
  }

  protected registerRoutes(): void {
    this.use(this.auth.middleware());
    this.use(this.auth.guard(['admin']));

    this.get(RouteConstants.SEGMENTS.ROOT, this.asyncHandler(async (_req, res) => {
      res.json({ appearances: this.manager.list() });
    }));

    // Marketplace catalog merged with install state (+ update-available flags). [] when marketplace is off.
    this.get(APPEARANCES_CATALOG, this.asyncHandler(async (_req, res) => {
      res.json({ appearances: await this.manager.catalog() });
    }));

    // Single install verb: install from the marketplace catalog by `slug`, else from a package `url`.
    this.post(APPEARANCES_INSTALL, this.asyncHandler(async (req, res) => {
      const slug = String(req.body?.slug || '').trim();
      const url = String(req.body?.url || '').trim();
      if (!slug && !url) {
        res.status(400).json({ error: 'A marketplace slug or a package URL is required.' });
        return;
      }
      const manifest = slug
        ? await this.manager.installFromCatalog(slug)
        : await this.manager.installFromUrl(url);
      res.json({ success: true, manifest });
    }));

    this.delete(APPEARANCES_SLUG, this.asyncHandler(async (req, res) => {
      this.manager.remove(req.params.slug);
      res.json({ success: true });
    }));
  }
}
