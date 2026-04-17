import { ThemeManifest, IDatabaseManager } from '../types';
import { SystemConstants } from '../constants';
import path from 'path';
import fs from 'fs';
import { Logger } from '../logging';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { Seeder } from '../database/seeder';
import { ProjectPaths } from '../config/paths';
import { ThemeInstallerService } from './theme-installer-service';
import { ThemeScaffoldService } from './theme-scaffold-service';
import { ThemeDefaultPageContractOverrideLoader } from './theme-default-page-contract-override-loader';
import type { ThemeDefaultPageContractOverride } from '../types';

export class ThemeManager {
  private activeTheme: string | null = null;
  private themes: Map<string, ThemeManifest> = new Map();
  private themesRoot: string;
  private logger = new Logger({ namespace: 'theme-manager' });
  private client: MarketplaceClient;
  private seeder: Seeder;
  private installer: ThemeInstallerService;
  private scaffolder: ThemeScaffoldService;
  private overrideLoader: ThemeDefaultPageContractOverrideLoader;

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
  }

  async checkForUpdates(slug: string): Promise<{ available: boolean; currentVersion: string; latestVersion?: string; updateUrl?: string }> {
    const theme = this.themes.get(slug);
    if (!theme) throw new Error(`Theme "${slug}" not found.`);
    if ((theme as any).updateUrl) {
      try {
        const response = await fetch((theme as any).updateUrl.replace('.zip', '.json'));
        if (response.ok) {
          const data = await response.json();
          if (data.version && data.version !== theme.version) {
            return { available: true, currentVersion: theme.version, latestVersion: data.version, updateUrl: data.downloadUrl || (theme as any).updateUrl };
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to check external update URL for ${slug}: ${(e as Error).message}`);
      }
    }
    try {
      const marketplaceThemes = await this.getMarketplaceThemes();
      const pkg = marketplaceThemes.find((t: any) => t.slug === slug);
      if (pkg && pkg.version !== theme.version) {
        return { available: true, currentVersion: theme.version, latestVersion: pkg.version, updateUrl: pkg.downloadUrl };
      }
    } catch (e) {}
    return { available: false, currentVersion: theme.version };
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
    try {
      this.logger.debug(`Fetching themes from marketplace...`);
      const data = await this.client.fetch();
      return data.themes || [];
    } catch (err: any) {
      this.logger.error(`Failed to fetch themes from marketplace: ${err.message}`);
      return [];
    }
  }

  async installTheme(pkg: any): Promise<void> {
    // Pass themes map so the installer can update after discovery
    return this.installer.installTheme(pkg);
  }

  async installFromZip(filePath: string): Promise<ThemeManifest> {
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
          const manifest: ThemeManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          this.themes.set(manifest.slug, manifest);
          this.logger.info(`Discovered theme: ${manifest.slug} v${manifest.version}`);
        } catch (e) {
          this.logger.error(`Failed to load theme manifest from ${dir}`, e);
        }
      }
    }
  }

  private async loadActiveTheme() {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.THEMES, { state: 'active' });
      if (row) { this.activeTheme = row.slug; this.logger.info(`Active theme set to: ${row.slug}`); }
    } catch (e) { this.logger.error("Failed to load active theme from DB", e); }
  }

  async activateTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

    const timestamp = new Date();
    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    const activeThemeRow = await this.db.findOne(SystemConstants.TABLE.THEMES, { state: 'active' });

    if (activeThemeRow && activeThemeRow.slug !== slug) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug: activeThemeRow.slug }, { state: 'inactive', updated_at: timestamp });
    }

    if (existing) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: 'active', updated_at: timestamp });
    } else {
      await this.db.insert(SystemConstants.TABLE.THEMES, { slug, name: manifest.name, version: manifest.version, state: 'active', created_at: timestamp, updated_at: timestamp });
    }

    await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: 'active', updated_at: timestamp });
    this.activeTheme = slug;
    this.logger.info(`Theme "${slug}" activated.`);
  }

  async disableTheme(slug: string) {
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    if (!existing && this.activeTheme !== slug) {
      return;
    }

    await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { state: 'inactive', updated_at: new Date() });
    if (this.activeTheme === slug) {
      this.activeTheme = null;
    }

    this.logger.info(`Theme "${slug}" disabled.`);
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
    this.logger.info(`Theme "${slug}" reset.`);
  }

  async saveThemeConfig(slug: string, config: { variables?: Record<string, string> }) {
    if (!this.themes.has(slug)) throw new Error(`Theme "${slug}" not found.`);
    const existing = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.THEMES, { slug }, { config: JSON.stringify(config), updated_at: new Date() });
    } else {
      const manifest = this.themes.get(slug)!;
      await this.db.insert(SystemConstants.TABLE.THEMES, { slug, name: manifest.name, version: manifest.version, state: 'inactive', config: JSON.stringify(config), created_at: new Date(), updated_at: new Date() });
    }
  }

  async getThemeConfig(slug: string): Promise<any> {
    const row = await this.db.findOne(SystemConstants.TABLE.THEMES, { slug });
    return row?.config || {};
  }

  async deleteTheme(slug: string) {
    if (this.activeTheme === slug) {
      await this.discoverThemes();
      const fallbackSlug = Array.from(this.themes.keys()).find((c) => c !== slug);
      if (fallbackSlug) {
        this.logger.info(`Theme "${slug}" is active. Activating fallback theme "${fallbackSlug}" before deletion.`);
        await this.activateTheme(fallbackSlug);
      } else {
        await this.db.update(SystemConstants.TABLE.THEMES, { state: 'active' }, { state: 'inactive' });
        this.activeTheme = null;
      }
    }
    const targetDir = this.resolveThemeDirectory(slug);
    if (fs.existsSync(targetDir)) { this.logger.info(`Deleting theme files at ${targetDir}`); fs.rmSync(targetDir, { recursive: true, force: true }); }
    this.themes.delete(slug);
    try { await this.db.delete(SystemConstants.TABLE.THEMES, { slug }); } catch (e: any) { this.logger.warn(`Failed to cleanup DB entries for deleted theme ${slug}: ${e.message}`); }
    this.logger.info(`Theme "${slug}" deleted.`);
  }

  getActiveThemeManifest(): ThemeManifest | null {
    if (!this.activeTheme) return null;
    return this.themes.get(this.activeTheme) || null;
  }

  getThemes(): (ThemeManifest & { state: 'active' | 'inactive' })[] {
    return Array.from(this.themes.values()).map((theme) => ({
      ...theme,
      state: theme.slug === this.activeTheme ? 'active' : 'inactive',
    }));
  }

  async getFrontendMetadata(runtimeModules: Record<string, any> = {}) {
    const theme = this.getActiveThemeManifest();
    if (!theme) return { activeTheme: null, runtimeModules };
    const config = await this.getThemeConfig(theme.slug);
    const variables = { ...(theme.variables || {}), ...(config.variables || {}) };
    const finalModules = { ...runtimeModules };
    const themeAny = theme as any;
    if (themeAny?.runtimeModules) Object.assign(finalModules, themeAny.runtimeModules);
    return {
      activeTheme: { slug: theme.slug, version: (theme as any).version || '0.0.0', variables, ui: theme.ui, layouts: theme.layouts, slots: theme.slots || [], overrides: (theme as any).overrides || [] },
      runtimeModules: finalModules,
      cssVariables: this.generateCssVariables(variables),
    };
  }

  private generateCssVariables(variables: Record<string, string>): string {
    const lines = Object.entries(variables).map(([key, value]) => {
      const cssKey = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      return `${cssKey}: ${value};`;
    });
    return `:root {\n  ${lines.join('\n  ')}\n}`;
  }

  async scaffoldTheme(input: {
    slug: string; name: string; description?: string; version?: string; activate?: boolean;
  }): Promise<{ slug: string; name: string; path: string; activated: boolean; activationError: string | null; manifest: any }> {
    return this.scaffolder.scaffoldTheme(input);
  }

  public getThemeDirectory(slug: string): string { return this.resolveThemeDirectory(slug); }

  async getActiveThemeDefaultPageContractOverrides(): Promise<ThemeDefaultPageContractOverride[]> {
    const manifest = this.getActiveThemeManifest();
    if (!manifest) {
      return [];
    }

    const themeDirectory = this.resolveThemeDirectory(manifest.slug);
    return this.overrideLoader.load(themeDirectory);
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
