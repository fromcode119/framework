import { ThemeAssetScope } from '@api/controllers/themes/enums/theme-asset-scope.enum';
import { TenantMode, ThemeState, TenantThemeAccess } from '@fromcode119/core';
import { Request, Response } from 'express';
import { ArchiveUploadSessionService, BaseController, ThemeManager, Logger } from '@fromcode119/core';
import fs from 'fs';
import { ThemeArchiveSupport } from '@api/controllers/themes/theme-archive-support';
import { CoercionUtils, CoreServices } from '@fromcode119/core';
import { ThemeUploadController } from '@api/controllers/themes/theme-upload-controller';

export class ThemeController extends BaseController {

  private logger = new Logger({ namespace: 'theme-controller' });
  private archiveSupport: ThemeArchiveSupport;

  private readonly uploads: ThemeUploadController;

  constructor(private manager: ThemeManager) {
    super();
    this.archiveSupport = new ThemeArchiveSupport(manager);
    this.uploads = new ThemeUploadController(manager, this.logger, this.archiveSupport);
  }

  async list(req: Request, res: Response) {
    // A tenant is isolated from every other tenant — no theme visible that is not ITS OWN, the same
    // rule the plugin list and the admin sidebar already enforce. "Its own" means every row
    // `_system_tenant_themes` holds for it: the one currently active, one retired by a later switch,
    // or one a platform admin merely prepared (saved config for, without activating) — never the
    // platform's full installed set. That set is answered in PLATFORM scope (no tenant bound), where
    // an operator assigns a theme to a site by editing the tenant record; a site admin then switches
    // only among what was assigned to it.
    const tenantId = String((req as any).tenantId || '').trim();
    const assignedSlugs = TenantMode.isEnabled() && tenantId
      ? await TenantThemeAccess.assignedSlugsFor(tenantId)
      : null;

    const themes = this.manager.getThemes()
      .filter((theme) => !assignedSlugs || assignedSlugs.has(theme.slug));

    res.json(themes.map((theme) => ({
      ...theme,
      multiTenant: TenantMode.isEnabled(),
      activeForTenant: TenantMode.isEnabled() ? theme.state === ThemeState.ACTIVE : null,
    })));
  }

  async checkUpdate(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      const result = await this.manager.checkForUpdates(slug);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getMarketplace(req: Request, res: Response) {
    try {
      const themes = await this.manager.getMarketplaceThemes();
      res.json({ themes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async install(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    const { version, url } = req.query;
    const { url: bodyUrl } = req.body;

    const downloadUrl = (url as string) || (bodyUrl as string);

    try {
      if (downloadUrl) {
         this.logger.info(`Installing theme "${slug}" from direct URL: ${downloadUrl}`);
         await this.manager.installTheme({ slug, downloadUrl });
         return res.json({ success: true, mode: 'direct' });
      }

      const themes = await this.manager.getMarketplaceThemes();
      const pkg = themes.find((t: any) =>
        t.slug === slug && (!version || t.version === version)
      );
      if (!pkg) return res.status(404).json({ error: `Theme ${slug} ${version ? 'v'+version : ''} not found in marketplace` });

      // An offer from THIS installation is a file on disk, not a URL. Its catalogue row borrows the
      // marketplace shape, whose only location is `downloadUrl` — so a locally built theme was
      // installed by resolving its bare filename against the REMOTE marketplace, producing
      // `https://marketplace.fromcode.com/.../aurora-0.1.29.zip` for a file sitting in this
      // installation's own workspace. The contributor that offered it is the one that knows where it is.
      const localPath = await this.resolveLocalPackage(pkg, slug);
      if (localPath) {
        this.logger.info(`Installing theme "${slug}" from this installation: ${localPath}`);
        await this.manager.installFromZip(localPath);
        return res.json({ success: true, mode: 'local' });
      }

      await this.manager.installTheme(pkg);
      res.json({ success: true, mode: 'marketplace' });
    } catch (err: any) {
      this.logger.error(`Failed to install theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Where a locally built theme actually is, or null when the offer came from a remote catalogue.
   *
   * Asked of the catalogue-contribution registry rather than of any named producer: this controller
   * must not know that something called Sources exists, only that whatever offered the package can
   * say where it put it. The path is resolved server-side from the offer the server itself looked
   * up, so nothing the caller sent chooses which file is opened.
   */
  private async resolveLocalPackage(pkg: unknown, slug: string): Promise<string | null> {
    const offer = CoercionUtils.toObject(pkg);
    if (CoercionUtils.toString(offer.source) !== 'local') return null;

    return CoreServices.getInstance().catalogContributions.resolveArtifact(
      slug,
      CoercionUtils.toString(offer.kind) || 'theme',
    );
  }

  /** @see ThemeUploadController.upload */
  upload(...args: Parameters<ThemeUploadController["upload"]>): ReturnType<ThemeUploadController["upload"]> {
    return this.uploads.upload(...args);
  }

  /** @see ThemeUploadController.uploadMine */
  uploadMine(...args: Parameters<ThemeUploadController["uploadMine"]>): ReturnType<ThemeUploadController["uploadMine"]> {
    return this.uploads.uploadMine(...args);
  }

  /** @see ThemeUploadController.deleteMine */
  deleteMine(...args: Parameters<ThemeUploadController["deleteMine"]>): ReturnType<ThemeUploadController["deleteMine"]> {
    return this.uploads.deleteMine(...args);
  }

  /** @see ThemeUploadController.inspectUpload */
  inspectUpload(...args: Parameters<ThemeUploadController["inspectUpload"]>): ReturnType<ThemeUploadController["inspectUpload"]> {
    return this.uploads.inspectUpload(...args);
  }

  /** @see ThemeUploadController.startUploadSession */
  startUploadSession(...args: Parameters<ThemeUploadController["startUploadSession"]>): ReturnType<ThemeUploadController["startUploadSession"]> {
    return this.uploads.startUploadSession(...args);
  }

  /** @see ThemeUploadController.uploadChunk */
  uploadChunk(...args: Parameters<ThemeUploadController["uploadChunk"]>): ReturnType<ThemeUploadController["uploadChunk"]> {
    return this.uploads.uploadChunk(...args);
  }

  /** @see ThemeUploadController.inspectStagedUpload */
  inspectStagedUpload(...args: Parameters<ThemeUploadController["inspectStagedUpload"]>): ReturnType<ThemeUploadController["inspectStagedUpload"]> {
    return this.uploads.inspectStagedUpload(...args);
  }

  /** @see ThemeUploadController.completeStagedUpload */
  completeStagedUpload(...args: Parameters<ThemeUploadController["completeStagedUpload"]>): ReturnType<ThemeUploadController["completeStagedUpload"]> {
    return this.uploads.completeStagedUpload(...args);
  }

  async activate(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.activateTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async disable(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.disableTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async reset(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    const runSeeds = req.body?.runSeeds !== false;
    const resetConfig = req.body?.resetConfig === true;

    try {
      await this.manager.resetTheme(slug, { runSeeds, resetConfig });
      res.json({ success: true, runSeeds, resetConfig });
    } catch (err: any) {
      this.logger.error(`Failed to reset theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async getConfig(req: Request, res: Response) {
    try {
      const slug = CoercionUtils.toString(req.params.slug);
      const config = await this.manager.getThemeConfig(slug);
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async saveConfig(req: Request, res: Response) {
    try {
      const slug = CoercionUtils.toString(req.params.slug);
      const config = req.body;
      await this.manager.saveThemeConfig(slug, config);
      res.json({ success: true, message: `Theme ${slug} configuration saved` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.deleteTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      this.logger.error(`Failed to delete theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async servePublicAssets(req: Request, res: Response) {
    this.archiveSupport.serveAssetDirectory(req, res, ThemeAssetScope.PUBLIC);
  }

  async serveAssets(req: Request, res: Response) {
    this.archiveSupport.serveAssetDirectory(req, res, ThemeAssetScope.UI);
  }
}
