import type { IThemeManifest } from '@core/interfaces/theme-manifest.interface';
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
import { ThemeEntryPreloadService } from '@core/theme/theme-entry-preload-service';
import { ThemeUpdateService } from '@core/theme/theme-update-service';
import type { IThemeDefaultPageContractOverride } from '@core/default-page-contract/interfaces/theme-default-page-contract-override.interface';
import { ThemeState } from '@core/theme/enums/theme-state.enum';

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
    return this.installer.installTheme(pkg);
  }

  async installFromZip(filePath: string): Promise<IThemeManifest> {
    return this.installer.installFromZip(filePath, this.themes);
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
        await this.materializeDefaultPages();
      }
    } catch (e) { this.logger.error("Failed to load active theme from DB", e); }
  }

  async activateTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

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
  }

  async disableTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

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
      if (existing) await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { config: null });
    }
    if (runSeeds) await this.installer.runSeeds(manifest);
    if (this.activeTheme === slug) {
      await this.materializeDefaultPages();
    }
    this.logger.info(`Theme "${slug}" reset.`);
  }

  async saveThemeConfig(slug: string, config: { variables?: Record<string, string> }) {
    return this.configService.saveThemeConfig(slug, config);
  }

  async getThemeConfig(slug: string): Promise<any> {
    return this.configService.getThemeConfig(slug);
  }

  async deleteTheme(slug: string) {
    if (this.activeTheme === slug) {
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

  getActiveThemeManifest(): IThemeManifest | null {
    if (!this.activeTheme) return null;
    return this.loadThemeManifestFromDisk(this.activeTheme) || this.themes.get(this.activeTheme) || null;
  }

  getThemes(): (IThemeManifest & { state: ThemeState })[] {
    return Array.from(this.themes.values()).map((theme) => ({
      ...theme,
      state: theme.slug === this.activeTheme ? ThemeState.ACTIVE : ThemeState.INACTIVE,
    }));
  }

  async getFrontendMetadata(runtimeModules: Record<string, any> = {}) {
    const manifest = this.getActiveThemeManifest();
    const metadata = await this.configService.getFrontendMetadata(manifest, runtimeModules);
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
        throw error;
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
