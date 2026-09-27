import { ThemeAssetScope } from '@api/controllers/themes/enums/theme-asset-scope.enum';
import { TenantMode, ThemeState, TenantThemeAccess } from '@fromcode119/core';
import { Request, Response } from 'express';
import { ArchiveUploadSessionService, BaseController, ThemeManager, Logger } from '@fromcode119/core';
import fs from 'fs';
import { ThemeArchiveSupport } from '@api/controllers/themes/theme-archive-support';
import { CoercionUtils } from '@fromcode119/core';
import { ThemeUploadController } from '@api/controllers/themes/theme-upload-controller';
import { ThemeMarketplaceInstall } from '@api/controllers/themes/theme-marketplace-install';

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

    // ...plus the themes the site uploaded itself (its own directory) — and never another site's own.
    // The same rule every action on a theme checks (`TenantThemeAccess.isAvailableTo`).
    const themes = this.manager.getThemes()
      .filter((theme) => !assignedSlugs || (theme.ownerTenantId ? theme.ownerTenantId === tenantId : assignedSlugs.has(theme.slug)));

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

      const mode = await new ThemeMarketplaceInstall(this.manager, this.logger).install(slug, version ? String(version) : undefined);
      if (!mode) return res.status(404).json({ error: `Theme ${slug} ${version ? 'v'+version : ''} not found in marketplace` });
      res.json({ success: true, mode });
    } catch (err: any) {
      this.logger.error(`Failed to install theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  /** @see ThemeUploadController.upload */
  upload(...args: Parameters<ThemeUploadController["upload"]>): ReturnType<ThemeUploadController["upload"]> {
    return this.uploads.upload(...args);
  }

  /** @see ThemeUploadController.uploadMine */
  uploadMine(...args: Parameters<ThemeUploadController["uploadMine"]>): ReturnType<ThemeUploadController["uploadMine"]> {
    return this.uploads.uploadMine(...args);
  }

  /** @see ThemeUploadController.mineQuota */
  mineQuota(...args: Parameters<ThemeUploadController["mineQuota"]>): ReturnType<ThemeUploadController["mineQuota"]> {
    return this.uploads.mineQuota(...args);
  }

  /** @see ThemeUploadController.addToSite */
  addToSite(...args: Parameters<ThemeUploadController["addToSite"]>): ReturnType<ThemeUploadController["addToSite"]> {
    return this.uploads.addToSite(...args);
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
    if (await this.refuseUnavailableTheme(req, res)) return;
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.activateTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async disable(req: Request, res: Response) {
    if (await this.refuseUnavailableTheme(req, res)) return;
    const slug = CoercionUtils.toString(req.params.slug);
    try {
      await this.manager.disableTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async reset(req: Request, res: Response) {
    if (await this.refuseUnavailableTheme(req, res)) return;
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
    if (await this.refuseUnavailableTheme(req, res)) return;
    try {
      const slug = CoercionUtils.toString(req.params.slug);
      const config = await this.manager.getThemeConfig(slug);
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async saveConfig(req: Request, res: Response) {
    if (await this.refuseUnavailableTheme(req, res)) return;
    try {
      const slug = CoercionUtils.toString(req.params.slug);
      const config = req.body;
      await this.manager.saveThemeConfig(slug, config);
      res.json({ success: true, message: `Theme ${slug} configuration saved` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * In a site, a theme it may not use is answered as absent: activating, configuring or resetting one
   * that is neither the site's own nor assigned to it used to succeed — a site could put another site's
   * privately uploaded theme on its own storefront by naming its slug. Answers whether it refused.
   */
  private async refuseUnavailableTheme(req: Request, res: Response): Promise<boolean> {
    const tenantId = String((req as any).tenantId || '').trim();
    if (!TenantMode.isEnabled() || !tenantId) return false;
    const slug = CoercionUtils.toString(req.params.slug);
    const theme = this.manager.getThemes().find((entry) => entry.slug === slug);
    if (theme && await TenantThemeAccess.isAvailableTo(tenantId, theme)) return false;
    res.status(404).json({ error: 'theme_not_available', message: `Theme "${slug}" is not available to this site.` });
    return true;
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
