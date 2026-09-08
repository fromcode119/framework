import { BaseRouter } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { AppearanceManager, Logger, RequestContextUtils, RouteConstants, SystemConstants, TenantMode } from '@fromcode119/core';
import { CoercionUtils } from '@fromcode119/core';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';
/**
 * Admin appearance management — a SETTINGS concern, deliberately separate from the plugin/theme
 * marketplace. Lists available appearances (built-in default + those in the appearances dir),
 * installs one from a URL/zip, and removes one. The ACTIVE appearance is the `admin_appearance`
 * system setting (switched via the settings UI), not handled here.
 */
export class AppearanceRouter extends BaseRouter {
  private readonly manager: AppearanceManager;

  constructor(
    private readonly auth: AuthManager,
    private readonly platformAdmin: PlatformAdminGuard,
    private readonly platformAccess: PlatformAccessResolver,
    private readonly db: any,
  ) {
    super();
    this.manager = new AppearanceManager(new Logger({ namespace: 'appearance' }));
  }

  /**
   * Appearance slugs claimed by ANOTHER site.
   *
   * An appearance is a branded admin console, and a workspace names the one it wears
   * (`_system_tenants.appearance`). Listing every installed appearance to every site administrator
   * therefore recited the other customers on the box by name — and offered a Remove next to each.
   * A platform admin still sees them all: the inventory is the platform's.
   */
  private async claimedByOtherSites(): Promise<Set<string>> {
    const current = String(RequestContextUtils.getTenantId() ?? '').trim();
    const rows = await this.db.find(SystemConstants.TABLE.TENANTS, {}).catch(() => [] as any[]);
    const claimed = new Set<string>();
    for (const row of rows ?? []) {
      const slug = String((row as any)?.appearance ?? '').trim();
      if (slug && String((row as any)?.id ?? '') !== current) claimed.add(slug);
    }
    return claimed;
  }

  protected registerRoutes(): void {
    this.use(this.auth.middleware());
    this.use(this.auth.guard(['admin']));

    this.get(RouteConstants.SEGMENTS.ROOT, this.asyncHandler(async (req, res) => {
      const appearances = this.manager.list();
      if (!TenantMode.isEnabled() || await this.platformAccess.isPlatformAdmin(req)) {
        res.json({ appearances });
        return;
      }
      const claimed = await this.claimedByOtherSites();
      res.json({ appearances: appearances.filter((entry: any) => !claimed.has(String(entry?.slug ?? ''))) });
    }));

    // Marketplace catalog merged with install state (+ update-available flags). [] when marketplace is off.
    // Browsing, installing and removing an appearance PACKAGE are platform actions: the package is code
    // on the one container every site runs on, and removing one takes another customer's console with it.
    const platform = this.platformAdmin.middleware();

    this.get(RouteConstants.SEGMENTS.APPEARANCES_CATALOG, platform, this.asyncHandler(async (_req, res) => {
      res.json({ appearances: await this.manager.catalog() });
    }));

    // Single install verb: install from the marketplace catalog by `slug`, else from a package `url`.
    this.post(RouteConstants.SEGMENTS.APPEARANCES_INSTALL, platform, this.asyncHandler(async (req, res) => {
      const slug = CoercionUtils.toString(req.body?.slug);
      const url = CoercionUtils.toString(req.body?.url);
      if (!slug && !url) {
        res.status(400).json({ error: 'A marketplace slug or a package URL is required.' });
        return;
      }
      const manifest = slug
        ? await this.manager.installFromCatalog(slug)
        : await this.manager.installFromUrl(url);
      res.json({ success: true, manifest });
    }));

    this.delete(RouteConstants.SEGMENTS.APPEARANCES_SLUG, platform, this.asyncHandler(async (req, res) => {
      this.manager.remove(CoercionUtils.toString(req.params.slug));
      res.json({ success: true });
    }));
  }
}
