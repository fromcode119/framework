import { ThemeManifest, IDatabaseManager } from '../types';
import { SystemTable } from '@fromcode119/sdk/internal';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { Logger } from '@fromcode119/sdk';
import { BackupService } from '../management/backup-service';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { Seeder } from '../database/seeder';
import { getThemesDir } from '../config/paths';

export class ThemeManager {
  private activeTheme: string | null = null;
  private themes: Map<string, ThemeManifest> = new Map();
  private themesRoot: string;
  private logger = new Logger({ namespace: 'theme-manager' });
  private client: MarketplaceClient;
  private seeder: Seeder;

  constructor(private db: any, private pluginManager?: any) {
    this.themesRoot = getThemesDir();
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

  async init() {
    await this.discoverThemes();
    await this.loadActiveTheme();
  }

  async ensureActiveThemeDependencies() {
    if (!this.activeTheme) return;

    const activeManifest = this.themes.get(this.activeTheme);
    if (!activeManifest) {
      this.logger.warn(`Active theme "${this.activeTheme}" is set but manifest was not found.`);
      return;
    }

    await this.installDependencies(activeManifest, { strict: true });
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

  async installFromZip(filePath: string): Promise<ThemeManifest> {
    const tempDir = path.join(path.dirname(filePath), `theme-ext-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      if (this.isZipArchive(filePath)) {
        const zip = new AdmZip(filePath);
        zip.extractAllTo(tempDir, true);
      } else {
        try {
          await BackupService.restore(filePath, tempDir);
        } catch (error: any) {
          if (String(error?.message || '').includes('TAR_BAD_ARCHIVE')) {
            throw new Error('Unsupported archive format. Upload a .zip theme package.');
          }
          throw error;
        }
      }

      const contentDir = this.findThemeManifestDir(tempDir);
      if (!contentDir) {
        throw new Error('Invalid theme: theme.json not found anywhere in the archive.');
      }

      const manifestContent = fs.readFileSync(path.join(contentDir, 'theme.json'), 'utf8');
      const manifest: ThemeManifest = JSON.parse(manifestContent);
      if (!manifest.slug) {
        throw new Error('Invalid theme: missing "slug" in theme.json.');
      }

      const targetDir = path.join(this.themesRoot, manifest.slug);
      if (fs.existsSync(targetDir)) {
        await BackupService.create(manifest.slug, targetDir, 'themes');
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });

      this.moveDir(contentDir, targetDir);
      await this.discoverThemes();

      const installedManifest = this.themes.get(manifest.slug) || manifest;
      await this.installDependencies(installedManifest);

      return installedManifest;
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // no-op cleanup
      }
    }
  }

  private async installDependencies(manifest: ThemeManifest, options?: { strict?: boolean }) {
    if (!this.pluginManager) return;

    const failures: string[] = [];
    await this.installBundledPlugins(manifest, failures);

    if (manifest.dependencies) {
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
            } else {
              this.logger.info(
                `Dependency "${depSlug}" already active for theme "${manifest.slug}". Forcing schema sync.`
              );
              await this.pluginManager.enable(depSlug, { force: true });
            }
            continue;
          }

          this.logger.info(`Installing dependency "${depSlug}" from marketplace for theme "${manifest.slug}"...`);
          await this.pluginManager.installOrUpdateFromMarketplace(depSlug);
          this.logger.info(`Dependency "${depSlug}" installed for theme "${manifest.slug}".`);
        } catch (err: any) {
          const message = `Failed to install dependency "${depSlug}" for theme "${manifest.slug}": ${err.message}`;
          failures.push(message);
          this.logger.error(message);
        }
      }
    }

    if (options?.strict && failures.length > 0) {
      throw new Error(failures.join(' | '));
    }
  }

  private async installBundledPlugins(manifest: ThemeManifest, failures: string[]) {
    const themePath = this.resolveThemeDirectory(manifest.slug);
    const archivePaths = this.getBundledPluginArchivePaths(manifest, themePath);
    if (archivePaths.length === 0) return;

    this.logger.info(`Installing ${archivePaths.length} bundled plugin archive(s) for theme "${manifest.slug}".`);

    const installedSlugs = new Set<string>();
    let installedOrUpdated = false;

    for (const archivePath of archivePaths) {
      try {
        const archiveManifest = this.readBundledPluginManifest(archivePath);
        if (archiveManifest?.slug) {
          const existing = this.pluginManager.plugins.get(archiveManifest.slug);
          if (existing) {
            const existingVersion = String(existing?.manifest?.version || '').trim();
            const archiveVersion = String(archiveManifest.version || '').trim();
            const sameVersion = !!existingVersion && !!archiveVersion && existingVersion === archiveVersion;

            if (sameVersion) {
              installedSlugs.add(archiveManifest.slug);
              this.logger.info(
                `Skipping bundled plugin "${archiveManifest.slug}" from ${archivePath} (already installed v${existingVersion}).`
              );
              continue;
            }
          }
        }

        const installed = await this.pluginManager.installFromZip(archivePath);
        installedOrUpdated = true;
        if (installed?.slug) installedSlugs.add(installed.slug);
        this.logger.info(`Installed bundled plugin "${installed.slug}" from ${archivePath}.`);
      } catch (err: any) {
        const message = `Failed to install bundled plugin archive "${archivePath}" for theme "${manifest.slug}": ${err.message}`;
        failures.push(message);
        this.logger.error(message);
      }
    }

    if (installedSlugs.size === 0) return;

    if (installedOrUpdated && typeof this.pluginManager.discoverPlugins === 'function') {
      await this.pluginManager.discoverPlugins();
    }

    for (const slug of installedSlugs) {
      try {
        await this.pluginManager.enable(slug);
      } catch (err: any) {
        const message = `Bundled plugin "${slug}" installed but failed to enable for theme "${manifest.slug}": ${err.message}`;
        failures.push(message);
        this.logger.error(message);
      }
    }
  }

  private getBundledPluginArchivePaths(manifest: ThemeManifest, themePath: string): string[] {
    const archives = new Set<string>();

    const addArchive = (absPath: string) => {
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile() && absPath.toLowerCase().endsWith('.zip')) {
        archives.add(absPath);
      }
    };

    const declared = (manifest as any).bundledPlugins;
    if (Array.isArray(declared)) {
      for (const entry of declared) {
        if (typeof entry !== 'string' || !entry.trim()) {
          this.logger.warn(`Ignoring invalid bundled plugin entry in theme "${manifest.slug}" manifest.`);
          continue;
        }

        const resolved = this.resolveThemeRelativePath(themePath, entry);
        if (!resolved) {
          this.logger.warn(`Ignoring bundled plugin path outside theme directory: ${entry}`);
          continue;
        }

        addArchive(resolved);
      }
    } else if (declared !== undefined) {
      this.logger.warn(`Theme "${manifest.slug}" has invalid "bundledPlugins" format. Expected string[].`);
    }

    for (const dirName of ['plugins', 'bundled-plugins']) {
      const dirPath = path.join(themePath, dirName);
      for (const zipPath of this.collectZipFiles(dirPath)) {
        addArchive(zipPath);
      }
    }

    return Array.from(archives);
  }

  private resolveThemeRelativePath(themePath: string, relativePath: string): string | null {
    const candidate = path.resolve(themePath, relativePath);
    const rel = path.relative(themePath, candidate);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return candidate;
  }

  private isZipArchive(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.zip') return true;
    if (ext === '.tar' || ext === '.tgz' || ext === '.gz') return false;

    try {
      const fd = fs.openSync(filePath, 'r');
      try {
        const header = Buffer.alloc(4);
        const bytesRead = fs.readSync(fd, header, 0, 4, 0);
        return bytesRead >= 2 && header[0] === 0x50 && header[1] === 0x4b;
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return false;
    }
  }

  private findThemeManifestDir(dir: string): string | null {
    if (fs.existsSync(path.join(dir, 'theme.json'))) return dir;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        const found = this.findThemeManifestDir(fullPath);
        if (found) return found;
      }
    }
    return null;
  }

  private collectZipFiles(rootDir: string): string[] {
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) return [];

    const files: string[] = [];
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const absolute = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.collectZipFiles(absolute));
      } else if (entry.isFile() && absolute.toLowerCase().endsWith('.zip')) {
        files.push(absolute);
      }
    }

    return files;
  }

  private readBundledPluginManifest(archivePath: string): { slug: string; version?: string } | null {
    try {
      if (!this.isZipArchive(archivePath)) return null;

      const zip = new AdmZip(archivePath);
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        if (!entry.entryName.toLowerCase().endsWith('manifest.json')) continue;

        const parsed = JSON.parse(entry.getData().toString('utf8'));
        const slug = String(parsed?.slug || '').trim();
        const version = String(parsed?.version || '').trim();
        if (slug) return { slug, version: version || undefined };
      }

      return null;
    } catch {
      return null;
    }
  }

  private async runSeeds(manifest: ThemeManifest) {
    const seeds = (manifest as any).seeds;
    if (!seeds) return;

    const themePath = this.resolveThemeDirectory(manifest.slug);
    const seedPath = path.resolve(themePath, seeds);

    if (fs.existsSync(seedPath)) {
      this.logger.info(`Executing seeds for theme "${manifest.slug}" from ${seedPath}...`);
      try {
        await this.seeder.seed(seedPath);
      } catch (err: any) {
        this.logger.error(`Failed to execute seeds for theme "${manifest.slug}": ${err.message}`);
        throw err;
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

  private resolveThemeDirectory(slug: string): string {
    const directPath = path.join(this.themesRoot, slug);
    if (fs.existsSync(directPath)) return directPath;

    if (!fs.existsSync(this.themesRoot)) {
      throw new Error(`Themes root not found: ${this.themesRoot}`);
    }

    const dirs = fs.readdirSync(this.themesRoot);
    for (const dir of dirs) {
      if (dir.startsWith('.')) continue;
      const candidate = path.join(this.themesRoot, dir);
      if (!fs.statSync(candidate).isDirectory()) continue;

      const manifestPath = path.join(candidate, 'theme.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest?.slug === slug) return candidate;
      } catch {
        // Ignore invalid manifests during path resolution.
      }
    }

    throw new Error(`Theme directory for slug "${slug}" not found in ${this.themesRoot}`);
  }

  public getThemeDirectory(slug: string): string {
    return this.resolveThemeDirectory(slug);
  }

  async discoverThemes() {
    this.logger.info(`Scanning for themes in ${this.themesRoot}...`);
    this.themes.clear();
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
      const row = await this.db.findOne(SystemTable.THEMES, { state: 'active' });
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
    await this.db.update(SystemTable.THEMES, { state: 'active' }, { state: 'inactive' });
    
    // Activate new
    const existing = await this.db.findOne(SystemTable.THEMES, { slug });
    if (existing) {
        await this.db.update(SystemTable.THEMES, { slug }, { state: 'active', updated_at: new Date() });
      } else {
        await this.db.insert(SystemTable.THEMES, { slug, state: 'active' });
    }
    
    this.activeTheme = slug;
    this.logger.info(`Theme "${slug}" activated. Processing dependencies and seeds...`);

    // Process Dependencies and Seeds
    await this.installDependencies(manifest, { strict: true });
    await this.runSeeds(manifest);

    this.logger.info(`Theme "${slug}" activation complete.`);
  }

  async resetTheme(slug: string, options?: { runSeeds?: boolean; resetConfig?: boolean }) {
    await this.discoverThemes();
    const manifest = this.themes.get(slug);
    if (!manifest) throw new Error(`Theme "${slug}" not found.`);

    const runSeeds = options?.runSeeds !== false;
    const resetConfig = options?.resetConfig === true;

    if (resetConfig) {
      const existing = await this.db.findOne(SystemTable.THEMES, { slug });
      const state = existing?.state || 'inactive';

      if (existing) {
        await this.db.update(SystemTable.THEMES, { slug }, { config: {}, updated_at: new Date() });
      } else {
        await this.db.insert(SystemTable.THEMES, { slug, state, config: {} });
      }

      this.logger.info(`Theme "${slug}" configuration reset to defaults.`);
    }

    if (runSeeds) {
      this.logger.info(`Theme "${slug}" reset requested: running dependencies + seeds.`);
      await this.installDependencies(manifest, { strict: true });
      await this.runSeeds(manifest);
    }

    this.logger.info(`Theme "${slug}" reset complete.`);
  }

  async saveThemeConfig(slug: string, config: { variables?: Record<string, string> }) {
    if (!this.themes.has(slug)) throw new Error(`Theme "${slug}" not found.`);
    
    const existing = await this.db.findOne(SystemTable.THEMES, { slug });
    if (existing) {
      const mergedConfig = {
        ...(existing.config || {}),
        ...config
      };
      await this.db.update(SystemTable.THEMES, { slug }, { config: mergedConfig, updated_at: new Date() });
    } else {
      await this.db.insert(SystemTable.THEMES, { slug, config, updated_at: new Date() });
    }
    
    this.logger.info(`Configuration saved for theme: ${slug}`);
  }

  async getThemeConfig(slug: string): Promise<any> {
    const row = await this.db.findOne(SystemTable.THEMES, { slug });
    return row?.config || {};
  }

  async deleteTheme(slug: string) {
    if (this.activeTheme === slug) {
      await this.discoverThemes();
      const fallbackSlug = Array.from(this.themes.keys()).find((candidate) => candidate !== slug);

      if (fallbackSlug) {
        this.logger.info(
          `Theme "${slug}" is active. Activating fallback theme "${fallbackSlug}" before deletion.`
        );
        await this.activateTheme(fallbackSlug);
      } else {
        this.logger.info(
          `Theme "${slug}" is the only installed theme. Continuing deletion and leaving no active theme.`
        );
        await this.db.update(SystemTable.THEMES, { state: 'active' }, { state: 'inactive' });
        this.activeTheme = null;
      }
    }
    
    const targetDir = this.resolveThemeDirectory(slug);
    if (fs.existsSync(targetDir)) {
      this.logger.info(`Deleting theme files at ${targetDir}`);
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    this.themes.delete(slug);
    
    // Also cleanup DB if entry exists
    try {
      await this.db.delete(SystemTable.THEMES, { slug });
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
        version: (theme as any).version || '0.0.0',
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

  async scaffoldTheme(input: {
    slug: string;
    name: string;
    description?: string;
    version?: string;
    activate?: boolean;
  }): Promise<{
    slug: string;
    name: string;
    path: string;
    activated: boolean;
    activationError: string | null;
    manifest: any;
  }> {
    const slug = String(input.slug || '').trim().toLowerCase();
    const name = String(input.name || '').trim();
    const description = String(input.description || '').trim();
    const version = String(input.version || '1.0.0').trim() || '1.0.0';
    const activate = input.activate !== false;

    if (!slug || !name) {
      throw new Error('Theme slug and name are required');
    }

    const themePath = path.join(this.themesRoot, slug);

    // Check if theme already exists
    if (this.themes.has(slug)) {
      throw new Error(`Theme "${slug}" already exists.`);
    }
    if (fs.existsSync(themePath)) {
      throw new Error(`Theme path already exists: ${themePath}`);
    }

    // Create directory structure
    fs.mkdirSync(path.join(themePath, 'ui'), { recursive: true });

    // Create theme manifest
    const themeManifest = {
      slug,
      name,
      version,
      description,
      author: 'Forge',
      ui: {
        entry: 'index.js',
        css: ['theme.css'],
      },
      variables: {
        primary: '#0ea5e9',
        accent: '#f97316',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
      },
    };

    // Create UI entry
    const uiEntry = [
      "import './theme.css';",
      '',
      'export const init = () => {',
      `  console.info('[theme:${slug}] initialized.');`,
      '};',
      '',
      'if (typeof window !== "undefined") {',
      '  init();',
      '}',
      '',
    ].join('\n');

    // Create theme CSS
    const themeCss = [
      ':root {',
      '  --theme-primary: #0ea5e9;',
      '  --theme-accent: #f97316;',
      '  --theme-background: #ffffff;',
      '  --theme-surface: #f8fafc;',
      '  --theme-text: #0f172a;',
      '}',
      '',
    ].join('\n');

    // Write files
    fs.writeFileSync(path.join(themePath, 'theme.json'), `${JSON.stringify(themeManifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(themePath, 'ui', 'index.js'), uiEntry, 'utf8');
    fs.writeFileSync(path.join(themePath, 'ui', 'theme.css'), themeCss, 'utf8');

    // Discover new theme
    await this.discoverThemes();

    // Activate if requested
    let activated = false;
    let activationError: string | null = null;
    if (activate) {
      try {
        await this.activateTheme(slug);
        activated = true;
      } catch (error: any) {
        activationError = String(error?.message || 'Activation failed');
      }
    }

    return {
      slug,
      name,
      path: themePath,
      activated,
      activationError,
      manifest: themeManifest,
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
