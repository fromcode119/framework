import { BaseRouter } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { AppearanceManager, Logger, RouteConstants, SystemConstants, TenantMode } from '@fromcode119/core';
import { CoercionUtils } from '@fromcode119/core';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import type { IAppearanceSummary } from '@fromcode119/core';
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
    private readonly db: any,
  ) {
    super();
    this.manager = new AppearanceManager(new Logger({ namespace: 'appearance' }));
  }

  /**
   * Which appearance is this SITE wearing right now.
   *
   * A site's choice is the per-site `admin_appearance` setting, not the tenant row — the row is the
   * workspace mechanism and core refuses to store one for a site. The read runs on the request's
   * tenant-bound connection, so row-level security already answers with this site's row and no
   * other's; an unreadable setting means "wearing the built-in default", never "wearing whatever
   * the platform has".
   */
  private async currentSiteAppearance(): Promise<string> {
    const row = await this.db
      .findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.ADMIN_APPEARANCE })
      .catch(() => null);
    return String((row as any)?.value ?? '').trim();
  }

  /**
   * `sourceUrl` is the package URL an appearance was installed from — platform provenance, and the
   * marketplace address of somebody else's brand. It belongs to the operator's catalogue, never to a
   * tenant-scoped answer.
   */
  private static withoutPlatformDetail(entries: IAppearanceSummary[]): IAppearanceSummary[] {
    return entries.map((entry) => ({ ...entry, sourceUrl: undefined }));
  }

  protected registerRoutes(): void {
    this.use(this.auth.middleware());
    this.use(this.auth.guard(['admin']));

    this.get(RouteConstants.SEGMENTS.ROOT, this.asyncHandler(async (req, res) => {
      const appearances = this.manager.list();

      // Platform scope (no tenant bound) sees the platform's full inventory, whoever is asking —
      // it is the one deciding what a workspace wears. A tenant-bound request, platform admin
      // included, is isolated exactly like the plugin list and the admin sidebar: it never reads
      // the platform's catalogue, only what is its own.
      if (!TenantMode.isEnabled() || !(req as any).tenantId) {
        res.json({ appearances });
        return;
      }

      // A WORKSPACE does not choose: its console is locked to its appearance by its KIND, and
      // `/system/admin/settings` answers a write of `admin_appearance` for one with 403
      // `kind_locks_appearance`. So it is shown exactly the appearance it wears — offering more
      // would be a picker whose every other option the API refuses (Rule Zero).
      const tenant = (req as any).tenant;
      if (tenant?.isWorkspace) {
        const own = String(tenant.appearance ?? '').trim();
        const worn = appearances.filter((entry) => (own ? entry.slug === own : entry.builtIn === true));
        res.json({ appearances: AppearanceRouter.withoutPlatformDetail(worn) });
        return;
      }

      // A SITE does choose — `admin_appearance` is a per-site setting — but only among what is its
      // own: the built-in console, plus whichever appearance it is wearing now. The rest of the
      // appearances dir is other customers' branded consoles, and reciting those to a site admin is
      // the inventory disclosure this filter exists to close. An operator puts a site on a different
      // appearance from PLATFORM scope, on the site's own record, exactly as with its theme.
      const current = await this.currentSiteAppearance();
      const own = appearances.filter((entry) => entry.builtIn === true || (!!current && entry.slug === current));
      res.json({ appearances: AppearanceRouter.withoutPlatformDetail(own) });
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
