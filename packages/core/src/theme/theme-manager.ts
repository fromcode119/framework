import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { ManifestNormalizer } from '@core/manifest-normalizer';
import { SystemConstants } from '@core/constants/system.constants';
import path from 'path';
import fs from 'fs';
import { Logger } from '@core/logging';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { Seeder } from '@core/database/seeder';
import { ProjectPaths } from '@core/config/paths';
import { ThemeInstallerService } from '@core/theme/theme-installer-service';
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

export class ThemeManager {
  private activeTheme: string | null = null;
  private themes: Map<string, IThemeManifest> = new Map();
  private themesRoot: string;
  private logger = new Logger({ namespace: 'theme-manager' });
  private client: MarketplaceClient;
  private seeder: Seeder;
  private installer: ThemeInstallerService;
  private scaffolder: ThemeScaffoldService;
  private overrideLoader: ThemeDefaultPageContractOverrideLoader;
  private configService: ThemeConfigService;
  private updateService: ThemeUpdateService;

  constructor(private db: any, private pluginManager?: any) {
    this.themesRoot = ProjectPaths.getThemesDir();
    this.client = new MarketplaceClient();
    this.seeder = new Seeder(db);
    this.installer = new ThemeInstallerService(
      this.logger,
      this.themesRoot,
      this.seeder,
      this.client,
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
    this.updateService = new ThemeUpdateService(this.themes, this.client, this.logger);
    // The tenant axis of theme activation reads on the REQUEST connection, like every per-request lookup.
    TenantThemeAccess.configure(db);
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
   * The storefront renders from the theme files this operation just replaced, and it holds them in
   * memory for the life of its process — see {@link StorefrontRendererRefreshService}. Awaited so the
   * restart is actually requested before the install reports success, but it can never fail the
   * install: the service reports an unreachable or absent frontend as a reason, not an error.
   */
  private async refreshStorefrontRenderer(reason: string): Promise<void> {
    await StorefrontRendererRefreshService.afterExtensionsChanged(reason, this.logger);
  }

  async discoverThemes() {
    this.logger.info(`Scanning for themes in ${this.themesRoot}...`);
    this.themes.clear();
    if (!fs.existsSync(this.themesRoot)) { fs.mkdirSync(this.themesRoot, { recursive: true }); return; }
    const dirs = fs.readdirSync(this.themesRoot);
    for (const dir of dirs) {
      if (dir.startsWith('.')) continue;
      const themePath = path.join(this.themesRoot, dir);
      const manifestPath = path.join(themePath, 'theme.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest: IThemeManifest = ManifestNormalizer.theme(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), themePath);
          this.themes.set(manifest.slug, manifest);
          this.logger.info(`Discovered theme: ${manifest.slug} v${manifest.version}`);
        } catch (e) {
          this.logger.error(`Failed to load theme manifest from ${dir}`, e);
        }
      }
    }
  }

  private loadThemeManifestFromDisk(slug: string): IThemeManifest | null {
    try {
      const themeDirectory = this.resolveThemeDirectory(slug);
      const manifestPath = path.join(themeDirectory, 'theme.json');
      if (!fs.existsSync(manifestPath)) {
        return null;
      }

      const manifest: IThemeManifest = ManifestNormalizer.theme(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), themeDirectory);
      this.themes.set(manifest.slug, manifest);
      return manifest;
    } catch (error) {
      this.logger.warn(`Failed to refresh theme manifest for ${slug}: ${(error as Error).message}`);
      return null;
    }
  }

  private async loadActiveTheme() {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.THEMES, { state: ThemeState.ACTIVE.value });
      if (row) {
        this.activeTheme = row.slug;
        this.logger.info(`Active theme set to: ${row.slug}`);
        // Boot has no tenant. On a multi-tenant deployment default pages are tenant-scoped rows, so
        // materializing here would write orphans no tenant can see (T0 §8.8's shape) — each tenant's
        // pages are materialized when ITS theme is activated, on its own connection.
        if (!TenantMode.isEnabled()) await this.materializeDefaultPages();
      }
    } catch (e) { this.logger.error("Failed to load active theme from DB", e); }
  }

  /** The tenant this request acts for, or a thrown error — theme activation is never ambiguous about whose site. */
  private requireTenant(action: string): string {
    const tenantId = RequestContextUtils.getTenantId();
    if (!tenantId) throw new Error(`Cannot ${action}: no site is selected for this request.`);
    return tenantId;
  }

  /**
   * Run a theme's declared INITIAL content (its `seeds` file) for the site this request is bound to.
   * On a multi-site platform the install-time seed runs untenanted and can write no site's rows, so a
   * site gets its theme's pages and navigation here — at creation, or on demand from the Sites page.
   * A theme without seeds is a no-op; a theme whose seed file is missing reports it rather than
   * pretending.
   */
  async seedThemeForCurrentSite(slug: string): Promise<{ seeded: boolean; reason?: string }> {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);
    if (!(manifest as any).seeds) return { seeded: false, reason: 'theme declares no seeds' };
    if (TenantMode.isEnabled()) this.requireTenant('seed a theme');
    await this.installer.runSeeds(manifest);
    return { seeded: true };
  }

  async activateTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

    // MULTI-TENANT: activation is a SITE action. It writes the tenant's row, materializes the tenant's
    // default pages on this (tenant-bound) connection, and touches no file — so it needs no storefront
    // restart: the tenant's next request carries a new render signature and the renderer rebuilds.
    if (TenantMode.isEnabled()) {
      const tenantId = this.requireTenant('activate a theme');
      await new TenantThemeStateService(this.db).activate(tenantId, slug);
      await this.materializeDefaultPages();
      this.logger.info(`Theme "${slug}" activated for tenant "${tenantId}".`);
      this.pluginManager?.emit?.('theme:activated', { slug, manifest, tenantId });
      return;
    }

    const timestamp = new Date();
    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    const activeThemeRow = await this.db.findOne(SystemConstants.TABLE.THEMES, { state: ThemeState.ACTIVE.value });

    if (activeThemeRow && activeThemeRow.slug !== slug) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug: activeThemeRow.slug }, { state: ThemeState.INACTIVE.value, updated_at: timestamp });
    }

    if (existing) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: ThemeState.ACTIVE.value, updated_at: timestamp });
    } else {
      await this.db.insert(SystemConstants.TABLE.THEMES, { slug, name: manifest.name, version: manifest.version, state: ThemeState.ACTIVE.value, created_at: timestamp, updated_at: timestamp });
    }

    await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: ThemeState.ACTIVE.value, updated_at: timestamp });
    this.activeTheme = slug;
    await this.materializeDefaultPages();
    this.logger.info(`Theme "${slug}" activated.`);
    this.pluginManager?.emit?.('theme:activated', { slug, manifest });
    // A different theme means a different server-render bundle; the storefront loaded the previous
    // one at boot and cannot swap it in place.
    await this.refreshStorefrontRenderer(`theme "${slug}" activated`);
  }

  async disableTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

    if (TenantMode.isEnabled()) {
      const tenantId = this.requireTenant('disable a theme');
      await new TenantThemeStateService(this.db).disable(tenantId, slug);
      this.logger.info(`Theme "${slug}" disabled for tenant "${tenantId}".`);
      this.pluginManager?.emit?.('theme:deactivated', { slug, tenantId });
      return;
    }

    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    if (!existing && this.activeTheme !== slug) {
      return;
    }

    await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: ThemeState.INACTIVE.value, updated_at: new Date() });
    if (this.activeTheme === slug) {
      this.activeTheme = null;
    }

    this.logger.info(`Theme "${slug}" disabled.`);
    this.pluginManager?.emit?.('theme:deactivated', { slug });
  }

  async resetTheme(slug: string, options?: { runSeeds?: boolean; resetConfig?: boolean }) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);
    const runSeeds = options?.runSeeds !== false;
    const resetConfig = options?.resetConfig === true;
    if (resetConfig) {
      const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
      if (TenantMode.isEnabled()) {
        await new TenantThemeStateService(this.db).saveConfig(this.requireTenant('reset a theme'), slug, null);
      } else if (existing) {
        await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { config: null });
      }
    }
    if (runSeeds) await this.installer.runSeeds(manifest);
    // Seeds and default pages write tenant-scoped rows; inside a request the connection is tenant-bound,
    // so on a multi-tenant deployment they land in the tenant that asked and nowhere else.
    if (this.getActiveThemeManifest()?.slug === slug) {
      await this.materializeDefaultPages();
    }
    this.logger.info(`Theme "${slug}" reset.`);
  }

  async saveThemeConfig(slug: string, config: { variables?: Record<string, string> }) {
    if (TenantMode.isEnabled()) {
      this.configService.validateThemeConfig(slug, config);
      return new TenantThemeStateService(this.db).saveConfig(this.requireTenant('configure a theme'), slug, config);
    }
    return this.configService.saveThemeConfig(slug, config);
  }

  async getThemeConfig(slug: string): Promise<any> {
    if (TenantMode.isEnabled()) {
      const choice = await TenantThemeAccess.choiceForAsync(this.requireTenant('read a theme config'));
      return choice.activeSlug === slug ? (choice.config || {}) : {};
    }
    return this.configService.getThemeConfig(slug);
  }

  async deleteTheme(slug: string) {
    if (TenantMode.isEnabled()) {
      // Every tenant's row for it goes, or a customer stays "active" on files that no longer exist and
      // its storefront logs NO SERVER RENDERING until someone notices. Said out loud, per tenant.
      const orphaned = await new TenantThemeStateService(this.db).clearForTheme(slug);
      for (const tenantId of orphaned) {
        this.logger.warn(`Theme "${slug}" was deleted while ACTIVE for tenant "${tenantId}": that site now renders with no theme.`);
      }
    } else if (this.activeTheme === slug) {
      await this.discoverThemes();
      const fallbackSlug = Array.from(this.themes.keys()).find((c) => c !== slug);
      if (fallbackSlug) {
        this.logger.info(`Theme "${slug}" is active. Activating fallback theme "${fallbackSlug}" before deletion.`);
        await this.activateTheme(fallbackSlug);
      } else {
        await this.db.update(SystemConstants.TABLE.THEMES, { state: ThemeState.ACTIVE.value }, { state: ThemeState.INACTIVE.value });
        this.activeTheme = null;
      }
    }
    const targetDir = this.resolveThemeDirectory(slug);
    if (fs.existsSync(targetDir)) { this.logger.info(`Deleting theme files at ${targetDir}`); fs.rmSync(targetDir, { recursive: true, force: true }); }
    this.themes.delete(slug);
    try { await this.db.delete(SystemConstants.TABLE.THEMES, { slug }); } catch (e: any) { this.logger.warn(`Failed to cleanup DB entries for deleted theme ${slug}: ${e.message}`); }
    this.logger.info(`Theme "${slug}" deleted.`);
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

  private async materializeDefaultPages(): Promise<void> {
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

  private resolveThemeDirectory(slug: string): string {
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
