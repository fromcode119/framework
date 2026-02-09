import { ThemeManifest, IDatabaseManager } from '../types';
import path from 'path';
import fs from 'fs';
import { Logger } from '../logging/logger';
import { BackupService } from '../management/backup';
import { MarketplaceClient } from '@fromcode/marketplace-client';
import { Seeder } from '../database/Seeder';

export class ThemeManager {
  private activeTheme: string | null = null;
  private themes: Map<string, ThemeManifest> = new Map();
  private themesRoot: string;
  private logger = new Logger({ namespace: 'ThemeManager' });
  private client: MarketplaceClient;
  private seeder: Seeder;

  constructor(private db: any, private pluginManager?: any) {
    const rootDir = this.getProjectRoot();
    this.themesRoot = process.env.THEMES_DIR 
      ? path.resolve(process.env.THEMES_DIR)
      : path.resolve(rootDir, 'themes');
    this.client = new MarketplaceClient();
    this.seeder = new Seeder(db);
  }

  async checkForUpdates(slug: string): Promise<{ available: boolean; currentVersion: string; latestVersion?: string; updateUrl?: string }> {
    const theme = this.themes.get(slug);
    if (!theme) throw new Error(`Theme "${slug}" not found.`);

    // 1. Check external updateUrl if defined in manifest
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

    // 2. Fallback to Marketplace
    try {
      const marketplaceThemes = await this.getMarketplaceThemes();
      const pkg = marketplaceThemes.find((t: any) => t.slug === slug);
      if (pkg && pkg.version !== theme.version) {
        return { available: true, currentVersion: theme.version, latestVersion: pkg.version, updateUrl: pkg.downloadUrl };
      }
    } catch (e) {}

    return { available: false, currentVersion: theme.version };
  }

  private getProjectRoot(): string {
    let current = process.cwd();
    while (current !== path.parse(current).root) {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === '@fromcode/framework') return current;
        } catch {}
      }
      current = path.dirname(current);
    }
    return process.cwd();
  }

  async init() {
    await this.discoverThemes();
    await this.loadActiveTheme();
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
    const { slug, downloadUrl: rawDownloadUrl } = pkg;
    
    const downloadUrl = this.client.resolveDownloadUrl(rawDownloadUrl);

    this.logger.info(`Installing theme "${slug}" from ${downloadUrl}...`);
    
    const tempDir = path.join(this.themesRoot, `.tmp-install-${slug}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      await BackupService.downloadAndExtract(downloadUrl, tempDir);
      
      const targetDir = path.join(this.themesRoot, slug);
      if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });
      
      // Move files
      this.moveDir(tempDir, targetDir);
      
      // Reload themes to read manifest
      await this.discoverThemes();
      const installedManifest = this.themes.get(slug);

      if (installedManifest) {
        await this.installDependencies(installedManifest);
      }

      this.logger.info(`Theme "${slug}" installed successfully.`);
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async installDependencies(manifest: ThemeManifest) {
    if (manifest.dependencies && this.pluginManager) {
      const depSlugs = Object.keys(manifest.dependencies);
      this.logger.info(`Checking dependencies for theme "${manifest.slug}": ${depSlugs.join(', ')}`);
      
      for (const depSlug of depSlugs) {
        try {
          // Check if already installed
          const existing = this.pluginManager.plugins.get(depSlug);
          if (existing) {
            if (existing.state !== 'active') {
              this.logger.info(`Activating existing dependency "${depSlug}" for theme "${manifest.slug}"...`);
              await this.pluginManager.enable(depSlug);
            }
            continue;
          }

          this.logger.info(`Installing dependency "${depSlug}" from marketplace for theme "${manifest.slug}"...`);
          await this.pluginManager.installOrUpdateFromMarketplace(depSlug);
          this.logger.info(`Dependency "${depSlug}" installed for theme "${manifest.slug}".`);
        } catch (err: any) {
          this.logger.error(`Failed to install dependency "${depSlug}" for theme "${manifest.slug}": ${err.message}`);
        }
      }
    }
  }

  private async runSeeds(manifest: ThemeManifest) {
    const seeds = (manifest as any).seeds;
    if (!seeds) return;

    const themePath = path.join(this.themesRoot, manifest.slug);
    const seedPath = path.resolve(themePath, seeds);

    if (fs.existsSync(seedPath)) {
      this.logger.info(`Executing seeds for theme "${manifest.slug}" from ${seedPath}...`);
      try {
        await this.seeder.seed(seedPath);
      } catch (err: any) {
        this.logger.error(`Failed to execute seeds for theme "${manifest.slug}": ${err.message}`);
      }
    } else {
      this.logger.warn(`Seed file specified in manifest not found: ${seedPath}`);
    }
  }

  private moveDir(src: string, dest: string) {
    const files = fs.readdirSync(src);
    for (const file of files) {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      if (fs.statSync(srcFile).isDirectory()) {
        if (!fs.existsSync(destFile)) fs.mkdirSync(destFile, { recursive: true });
        this.moveDir(srcFile, destFile);
      } else {
        try { fs.renameSync(srcFile, destFile); } 
        catch (e) { fs.copyFileSync(srcFile, destFile); fs.unlinkSync(srcFile); }
      }
    }
  }

  async discoverThemes() {
    this.logger.info(`Scanning for themes in ${this.themesRoot}...`);
    if (!fs.existsSync(this.themesRoot)) {
        fs.mkdirSync(this.themesRoot, { recursive: true });
        return;
    }

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
      const row = await this.db.findOne('_system_themes', { state: 'active' });
      if (row) {
        this.activeTheme = row.slug;
        this.logger.info(`Active theme set to: ${row.slug}`);
      }
    } catch (e) {
      this.logger.error("Failed to load active theme from DB", e);
    }
  }

  async activateTheme(slug: string) {
    await this.discoverThemes(); // Ensure we have latest themes from disk
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);
    
    // Deactivate previous
    await this.db.update('_system_themes', { state: 'active' }, { state: 'inactive' });
    
    // Activate new
    const existing = await this.db.findOne('_system_themes', { slug });
    if (existing) {
        await this.db.update('_system_themes', { slug }, { state: 'active', updated_at: new Date() });
    } else {
        await this.db.insert('_system_themes', { slug, state: 'active' });
    }
    
    this.activeTheme = slug;
    this.logger.info(`Theme "${slug}" activated. Processing dependencies and seeds...`);

    // Process Dependencies and Seeds
    await this.installDependencies(manifest);
    await this.runSeeds(manifest);

    this.logger.info(`Theme "${slug}" activation complete.`);
  }

  async saveThemeConfig(slug: string, config: { variables?: Record<string, string> }) {
    if (!this.themes.has(slug)) throw new Error(`Theme "${slug}" not found.`);
    
    const existing = await this.db.findOne('_system_themes', { slug });
    if (existing) {
      const mergedConfig = {
        ...(existing.config || {}),
        ...config
      };
      await this.db.update('_system_themes', { slug }, { config: mergedConfig, updated_at: new Date() });
    } else {
      await this.db.insert('_system_themes', { slug, config, updated_at: new Date() });
    }
    
    this.logger.info(`Configuration saved for theme: ${slug}`);
  }

  async getThemeConfig(slug: string): Promise<any> {
    const row = await this.db.findOne('_system_themes', { slug });
    return row?.config || {};
  }

  async deleteTheme(slug: string) {
    if (this.activeTheme === slug) {
      throw new Error(`Cannot delete theme "${slug}" because it is currently active.`);
    }
    
    const targetDir = path.join(this.themesRoot, slug);
    if (fs.existsSync(targetDir)) {
      this.logger.info(`Deleting theme files at ${targetDir}`);
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    this.themes.delete(slug);
    
    // Also cleanup DB if entry exists
    try {
      await this.db.delete('_system_themes', { slug });
    } catch (e: any) {
      this.logger.warn(`Failed to cleanup DB entries for deleted theme ${slug}: ${e.message}`);
    }

    this.logger.info(`Theme "${slug}" deleted.`);
  }

  getActiveThemeManifest(): ThemeManifest | null {
    if (!this.activeTheme) return null;
    return this.themes.get(this.activeTheme) || null;
  }

  getThemes(): (ThemeManifest & { state: 'active' | 'inactive' })[] {
    return Array.from(this.themes.values()).map(t => ({
      ...t,
      state: t.slug === this.activeTheme ? 'active' : 'inactive'
    }));
  }

  async getFrontendMetadata(runtimeModules: Record<string, any> = {}) {
    const theme = this.getActiveThemeManifest();
    if (!theme) return { activeTheme: null, runtimeModules };

    const config = await this.getThemeConfig(theme.slug);
    const variables = {
      ...(theme.variables || {}),
      ...(config.variables || {})
    };
    
    // Merge framework runtime modules with any theme-specific overrides
    const finalModules = {
      ...runtimeModules
    };

    // Themes can provide their own specific library overrides if needed
    const themeAny = theme as any;
    if (themeAny && themeAny.runtimeModules) {
       Object.assign(finalModules, themeAny.runtimeModules);
    }

    return {
      activeTheme: {
        slug: theme.slug,
        variables,
        ui: theme.ui,
        layouts: theme.layouts,
        slots: theme.slots || [],
        overrides: (theme as any).overrides || []
      },
      runtimeModules: finalModules,
      cssVariables: this.generateCssVariables(variables)
    };
  }

  private generateCssVariables(variables: Record<string, string>): string {
    const lines = Object.entries(variables).map(([key, value]) => {
      // Convert camelCase or whatever to --theme-variable-name
      const cssKey = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      return `${cssKey}: ${value};`;
    });
    return `:root {\n  ${lines.join('\n  ')}\n}`;
  }
}
