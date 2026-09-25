import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { ManifestNormalizer } from '@core/manifest-normalizer';
import { SystemConstants } from '@core/constants/system.constants';
import path from 'path';
import fs from 'fs';
import { Logger } from '@core/logging';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { SiteMarketplaceUrl } from '@core/marketplace/site-marketplace-url';
import { Seeder } from '@core/database/seeder';
import { ProjectPaths } from '@core/config/paths';
import { ThemeInstallerService } from '@core/theme/theme-installer-service';
import { TenantThemeQuota } from '@core/theme/tenant-theme-quota';
import { ThemeScaffoldService } from '@core/theme/theme-scaffold-service';
import { ThemeDefaultPageContractOverrideLoader } from '@core/theme/theme-default-page-contract-override-loader';
import { PluginDefaultPageMaterializationRuntimeService } from '@core/services/default-page-contract/plugin-default-page-materialization-runtime-service';
import { ThemeConfigService } from '@core/theme/theme-config-service';
import { StorefrontRendererRefreshService } from '@core/management/storefront-renderer-refresh-service';
import { ThemeEntryPreloadService } from '@core/theme/theme-entry-preload-service';
import { ThemeUpdateService } from '@core/theme/theme-update-service';
import type { IThemeDefaultPageContractOverride } from '@core/default-page-contract/interfaces/theme-default-page-contract-override.interface';
import { ThemeState } from '@core/theme/enums/theme-state.enum';
import { TenantMode } from '@core/tenant/tenant-mode';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';
import { TenantThemeStateService } from '@core/theme/tenant-theme-state-service';
import { ThemeLifecycle } from '@core/theme/theme-lifecycle';

export class ThemeManager extends ThemeLifecycle {
  protected activeTheme: string | null = null;
  protected themes: Map<string, IThemeManifest> = new Map();
  protected themesRoot: string;
  protected logger = new Logger({ namespace: 'theme-manager' });
  protected seeder: Seeder;
  protected installer: ThemeInstallerService;
  private scaffolder: ThemeScaffoldService;
  private overrideLoader: ThemeDefaultPageContractOverrideLoader;
  protected configService: ThemeConfigService;
  private updateService: ThemeUpdateService;

  constructor(protected db: any, protected pluginManager?: any) {
    super();
    this.themesRoot = ProjectPaths.getThemesDir();
    this.seeder = new Seeder(db);
    this.installer = new ThemeInstallerService(
      this.logger,
      this.themesRoot,
      this.seeder,
      () => ThemeManager.marketplaceClient(),
      pluginManager,
      () => this.discoverThemes(),
      (slug) => this.resolveThemeDirectory(slug),
    );
    this.scaffolder = new ThemeScaffoldService(
      this.logger,
      this.themesRoot,
      (slug) => this.themes.has(slug),
      () => this.discoverThemes(),
      (slug) => this.activateTheme(slug),
    );
    this.overrideLoader = new ThemeDefaultPageContractOverrideLoader();
    this.configService = new ThemeConfigService(db, this.themes);
    this.updateService = new ThemeUpdateService(this.themes, () => ThemeManager.marketplaceClient(), this.logger);
    // The tenant axis of theme activation reads on the REQUEST connection, like every per-request lookup.
    TenantThemeAccess.configure(db);
  }

  /**
   * The catalogue in force for this request's site — the one the plugin marketplace uses. Built from
   * the environment alone, once, in the constructor, the theme screens ignored the Marketplace URL an
   * operator saved and went on reading whatever the api was started with.
   */
  private static async marketplaceClient(): Promise<MarketplaceClient> {
    return new MarketplaceClient(await SiteMarketplaceUrl.current(process.env.MARKETPLACE_URL));
  }

  async checkForUpdates(slug: string): Promise<{ available: boolean; currentVersion: string; latestVersion?: string; updateUrl?: string }> {
    return this.updateService.checkForUpdates(slug);
  }

  async init() {
    await this.discoverThemes();
    await this.loadActiveTheme();
  }

  async ensureActiveThemeDependencies() {
    if (!this.activeTheme) return;
    const activeManifest = this.themes.get(this.activeTheme);
    if (!activeManifest) { this.logger.warn(`Active theme "${this.activeTheme}" is set but manifest was not found.`); return; }
    await this.installer.installDependencies(activeManifest, { strict: true });
  }

  async getMarketplaceThemes() {
    return this.updateService.getMarketplaceThemes();
  }

  async installTheme(pkg: any): Promise<void> {
    // Pass themes map so the installer can update after discovery
    await this.installer.installTheme(pkg);
    await this.refreshStorefrontRenderer(`theme "${String(pkg?.slug || '').trim() || 'unknown'}" installed`);
  }

  /**
   * Installs a theme from a package directory this installation built.
   *
   * Same refresh as the archive path: the storefront renders from the files that just changed.
   */
  async installFromDirectory(packageDir: string): Promise<IThemeManifest> {
    const manifest = await this.installer.installFromDirectory(packageDir, this.themes);
    await this.refreshStorefrontRenderer(`theme "${manifest.slug}" installed`);
    return manifest;
  }

  async installFromZip(filePath: string): Promise<IThemeManifest> {
    const manifest = await this.installer.installFromZip(filePath, this.themes);
    await this.refreshStorefrontRenderer(`theme "${manifest.slug}" installed`);
    return manifest;
  }

  /**
   * Installs a theme a SITE uploaded, into that site's own directory.
   *
   * The storefront renderer is refreshed exactly as for a platform install: this site's storefront
   * holds theme files in memory for the life of its process, so without it the upload would appear to
   * succeed and change nothing until something else restarted that process.
   */
  async installForTenant(filePath: string, tenantId: string): Promise<IThemeManifest> {
    const quota = await TenantThemeQuota.current();
    const manifest = await this.installer.installForTenant(filePath, tenantId, this.themes, quota);
    await this.refreshStorefrontRenderer(`theme "${manifest.slug}" uploaded by site "${tenantId}"`);
    return manifest;
  }

  /**
   * Removes a theme a SITE uploaded, and only ever one of ITS OWN.
   *
   * Ownership is re-checked here against what discovery found on disk rather than trusted from the
   * request: the slug arrives in a URL, and the platform's themes and every other site's live under
   * the same root. Refusing by "not yours" rather than "not found" is deliberate — the caller already
   * knows the slug it typed, so there is nothing to disclose by being clear.
   */
  async removeTenantTheme(slug: string, tenantId: string): Promise<void> {
    const owner = String(tenantId ?? '').trim();
    const name = String(slug ?? '').trim();
    if (!owner) throw new Error('A site must be selected to remove a theme.');

    const manifest = this.themes.get(name);
    if (!manifest) throw new Error(`Theme "${name}" is not installed.`);
    if (manifest.ownerTenantId !== owner) {
      throw new Error(`Theme "${name}" does not belong to this site, so it cannot be removed here.`);
    }

    const directory = path.join(ProjectPaths.getThemesDirFor(owner), name);
    if (fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true });
    await this.discoverThemes();
    await this.refreshStorefrontRenderer(`theme "${name}" removed by site "${owner}"`);
  }

  /**
   * The storefront renders from the theme files this operation just replaced, and it holds them in
   * memory for the life of its process — see {@link StorefrontRendererRefreshService}. Awaited so the
   * restart is actually requested before the install reports success, but it can never fail the
   * install: the service reports an unreachable or absent frontend as a reason, not an error.
   */
  protected async refreshStorefrontRenderer(reason: string): Promise<void> {
    await StorefrontRendererRefreshService.afterExtensionsChanged(reason, this.logger);
  }


  /** The tenant this request acts for, or a thrown error — theme activation is never ambiguous about whose site. */
  protected requireTenant(action: string): string {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) throw new Error(`Cannot ${action}: no site is selected for this request.`);
    return tenantId;
  }

  /**
   * The slug the CURRENT request renders with. Single-tenant: the process-wide field, as always.
   * Multi-tenant: the request's tenant's choice — and a request with no tenant gets NO theme, never
   * another site's.
   */
  private currentActiveSlug(): string | null {
    const choice = TenantThemeAccess.currentChoice();
    if (choice === null) return this.activeTheme;
    return choice.activeSlug;
  }

  getActiveThemeManifest(): IThemeManifest | null {
    const slug = this.currentActiveSlug();
    if (!slug) return null;
    return this.loadThemeManifestFromDisk(slug) || this.themes.get(slug) || null;
  }

  /** Every INSTALLED theme, with `state` = active for the current request's site. */
  getThemes(): (IThemeManifest & { state: ThemeState })[] {
    const active = this.currentActiveSlug();
    return Array.from(this.themes.values()).map((theme) => ({
      ...theme,
      state: theme.slug === active ? ThemeState.ACTIVE : ThemeState.INACTIVE,
    }));
  }

  async getFrontendMetadata(runtimeModules: Record<string, any> = {}) {
    const manifest = this.getActiveThemeManifest();
    // The TENANT's variable overrides, when there is a tenant; the platform row's otherwise.
    const choice = TenantThemeAccess.currentChoice();
    const configOverride = choice && manifest && choice.activeSlug === manifest.slug ? (choice.config || {}) : undefined;
    const metadata = await this.configService.getFrontendMetadata(manifest, runtimeModules, configOverride);
    // Expose the real entry + its static chunk dependencies so the frontend can emit
    // `<link rel="modulepreload">` hints and skip the shim's serialized round-trip.
    // Server-derived from the active theme's own ui/ directory only — never request input.
    const activeTheme = (metadata as any)?.activeTheme;
    if (activeTheme && manifest?.slug) {
      const modulepreload = ThemeEntryPreloadService.resolveModulePreloadList(
        this.getThemeDirectory(manifest.slug),
        String((manifest.ui as any)?.entry || ''),
      );
      if (modulepreload.length > 0) {
        activeTheme.ui = { ...(activeTheme.ui || {}), modulepreload };
      }
    }
    return metadata;
  }

  async scaffoldTheme(input: {
    slug: string; name: string; description?: string; version?: string; activate?: boolean;
  }): Promise<{ slug: string; name: string; path: string; activated: boolean; activationError: string | null; manifest: any }> {
    return this.scaffolder.scaffoldTheme(input);
  }

  public getThemeDirectory(slug: string): string { return this.resolveThemeDirectory(slug); }

  async getActiveThemeDefaultPageContractOverrides(): Promise<IThemeDefaultPageContractOverride[]> {
    const manifest = this.getActiveThemeManifest();
    if (!manifest) {
      return [];
    }

    const themeDirectory = this.resolveThemeDirectory(manifest.slug);
    return this.overrideLoader.load(themeDirectory);
  }

  protected async materializeDefaultPages(): Promise<void> {
    if (!this.pluginManager) {
      return;
    }

    try {
      const service = new PluginDefaultPageMaterializationRuntimeService(
        this.pluginManager,
        () => this.getActiveThemeDefaultPageContractOverrides(),
      );
      await service.materialize();
    } catch (error) {
      if (PluginDefaultPageMaterializationRuntimeService.isRequiredRouteFailure(error)) {
        // A theme pass belongs to no single plugin, so it has no plugin to fail. Rethrowing here
        // aborted theme activation over a route some unrelated plugin declared, and at boot it left
        // the install with no active theme at all. Report it and let the theme apply.
        this.logger.error(`Default page materialization reported unreconciled required routes after theme change: ${(error as Error).message}`);
        return;
      }
      this.logger.warn(`Default page materialization failed after theme change: ${(error as Error).message}`);
    }
  }

  protected resolveThemeDirectory(slug: string): string {
    const directPath = path.join(this.themesRoot, slug);
    if (fs.existsSync(directPath)) return directPath;
    if (!fs.existsSync(this.themesRoot)) throw new Error(`Themes root not found: ${this.themesRoot}`);
    for (const dir of fs.readdirSync(this.themesRoot)) {
      if (dir.startsWith('.')) continue;
      const candidate = path.join(this.themesRoot, dir);
      if (!fs.statSync(candidate).isDirectory()) continue;
      const manifestPath = path.join(candidate, 'theme.json');
      if (!fs.existsSync(manifestPath)) continue;
      try { const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); if (m?.slug === slug) return candidate; } catch {}
    }
    throw new Error(`Theme directory for slug "${slug}" not found in ${this.themesRoot}`);
  }
}
