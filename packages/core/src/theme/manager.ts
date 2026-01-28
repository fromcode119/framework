import { ThemeManifest, IDatabaseManager } from '../types';
import path from 'path';
import fs from 'fs';
import { Logger } from '../logging/logger';
import { BackupService } from '../management/backup';

export class ThemeManager {
  private activeTheme: string | null = null;
  private themes: Map<string, ThemeManifest> = new Map();
  private themesRoot: string;
  private logger = new Logger({ namespace: 'ThemeManager' });
  private registryUrl: string;

  constructor(private db: any) {
    const rootDir = this.getProjectRoot();
    this.themesRoot = process.env.THEMES_DIR 
      ? path.resolve(process.env.THEMES_DIR)
      : path.resolve(rootDir, 'themes');
    this.registryUrl = process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json';
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

  async getRegistryThemes() {
    try {
      this.logger.debug(`Fetching themes from registry: ${this.registryUrl}`);
      const res = await fetch(this.registryUrl);
      if (!res.ok) throw new Error(`Registry returned ${res.status}`);
      const data: any = await res.json();
      return data.themes || [];
    } catch (err: any) {
      this.logger.error(`Failed to fetch themes from registry: ${err.message}`);
      return [];
    }
  }

  async installTheme(pkg: any): Promise<void> {
    const { slug, downloadUrl: rawDownloadUrl } = pkg;
    
    const downloadUrl = rawDownloadUrl.startsWith('.') 
        ? new URL(rawDownloadUrl, this.registryUrl).href
        : rawDownloadUrl;

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
      
      // Reload themes
      await this.discoverThemes();
      this.logger.info(`Theme "${slug}" installed successfully.`);
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
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
    if (!this.themes.has(slug)) throw new Error(`Theme "${slug}" not found.`);
    
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
    this.logger.info(`Theme "${slug}" activated.`);
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
    } catch (e) {
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

  getFrontendMetadata() {
    const theme = this.getActiveThemeManifest();
    return {
      activeTheme: theme ? {
        slug: theme.slug,
        variables: theme.variables || {},
        ui: theme.ui,
        layouts: theme.layouts,
        slots: theme.slots || []
      } : null
    };
  }
}
