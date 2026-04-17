/** ThemeInstallerService — handles theme package installation. Extracted from ThemeManager (ARC-007). */

import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { Logger } from '../logging';
import { ThemeManifest } from '../types';
import { BackupService } from '../management/backup-service';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { Seeder } from '../database/seeder';

export class ThemeInstallerService {
  constructor(
    private readonly logger: Logger,
    private readonly themesRoot: string,
    private readonly seeder: Seeder,
    private readonly client: MarketplaceClient,
    private readonly pluginManager: any,
    private readonly discoverThemes: () => Promise<void>,
    private readonly resolveThemeDirectory: (slug: string) => string,
  ) {}

  // --- Public install methods ---

  async installTheme(pkg: any): Promise<void> {
    const { slug, downloadUrl: rawDownloadUrl } = pkg;
    const downloadUrl = this.client.resolveDownloadUrl(rawDownloadUrl);
    this.logger.info(`Installing theme "${slug}" from ${downloadUrl}...`);
    const tempDir = path.join(this.themesRoot, `.tmp-install-${slug}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      await BackupService.downloadAndExtract(downloadUrl, tempDir);
      const targetDir = path.join(this.themesRoot, slug);
      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
      fs.mkdirSync(targetDir, { recursive: true });
      this.moveDir(tempDir, targetDir);
      await this.discoverThemes();
      const installedManifest = this.pluginManager?._themes?.get?.(slug);
      if (installedManifest) await this.installDependencies(installedManifest);
      this.logger.info(`Theme "${slug}" installed successfully.`);
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async installFromZip(filePath: string, themesMap: Map<string, ThemeManifest>): Promise<ThemeManifest> {
    const tempDir = path.join(path.dirname(filePath), `theme-ext-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      if (this.isZipArchive(filePath)) {
        new AdmZip(filePath).extractAllTo(tempDir, true);
      } else {
        try {
          await BackupService.restore(filePath, tempDir);
        } catch (error: any) {
          if (String(error?.message || '').includes('TAR_BAD_ARCHIVE')) throw new Error('Unsupported archive format. Upload a .zip or .tar.gz theme package.');
          throw error;
        }
      }
      const contentDir = this.findThemeManifestDir(tempDir);
      if (!contentDir) throw new Error('Invalid theme: theme.json not found anywhere in the archive.');
      const manifest: ThemeManifest = JSON.parse(fs.readFileSync(path.join(contentDir, 'theme.json'), 'utf8'));
      if (!manifest.slug) throw new Error('Invalid theme: missing "slug" in theme.json.');
      const targetDir = path.join(this.themesRoot, manifest.slug);
      if (fs.existsSync(targetDir)) {
        await BackupService.create(manifest.slug, targetDir, 'themes');
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });
      this.moveDir(contentDir, targetDir);
      await this.discoverThemes();
      const installedManifest = themesMap.get(manifest.slug) || manifest;
      await this.installDependencies(installedManifest);
      return installedManifest;
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* no-op */ }
    }
  }

  async installDependencies(manifest: ThemeManifest, options?: { strict?: boolean }) {
    if (!this.pluginManager) return;
    const failures: string[] = [];
    await this.installBundledPlugins(manifest, failures);
    if (manifest.dependencies) {
      const depSlugs = Object.keys(manifest.dependencies);
      this.logger.info(`Checking dependencies for theme "${manifest.slug}": ${depSlugs.join(', ')}`);
      for (const depSlug of depSlugs) {
        try {
          const existing = this.pluginManager.plugins.get(depSlug);
          if (existing) {
            if (existing.state !== 'active') await this.pluginManager.enable(depSlug);
            else await this.pluginManager.enable(depSlug, { force: true });
            continue;
          }
          await this.pluginManager.installOrUpdateFromMarketplace(depSlug);
        } catch (err: any) {
          const msg = `Failed to install dependency "${depSlug}" for theme "${manifest.slug}": ${err.message}`;
          failures.push(msg); this.logger.error(msg);
        }
      }
    }
    if (options?.strict && failures.length > 0) throw new Error(failures.join(' | '));
  }

  async runSeeds(manifest: ThemeManifest) {
    const seeds = (manifest as any).seeds;
    if (!seeds) return;
    const themePath = this.resolveThemeDirectory(manifest.slug);
    const seedPath = path.resolve(themePath, seeds);
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Theme "${manifest.slug}" declares seeds at "${seeds}", but the file was not found at ${seedPath}.`);
    }

    this.logger.info(`Executing seeds for theme "${manifest.slug}" from ${seedPath}...`);
    try { await this.seeder.seed(seedPath); }
    catch (err: any) { this.logger.error(`Failed to execute seeds for theme "${manifest.slug}": ${err.message}`); throw err; }
  }

  // --- Private file helpers ---

  private async installBundledPlugins(manifest: ThemeManifest, failures: string[]) {
    const themePath = this.resolveThemeDirectory(manifest.slug);
    const archivePaths = this.getBundledPluginArchivePaths(manifest, themePath);
    if (archivePaths.length === 0) return;
    this.logger.info(`Installing ${archivePaths.length} bundled plugin archive(s) for theme "${manifest.slug}".`);
    const installedSlugs = new Set<string>();
    let installedOrUpdated = false;
    for (const archivePath of archivePaths) {
      try {
        const archiveManifest = await this.readBundledPluginManifest(archivePath);
        if (archiveManifest?.slug) {
          const existing = this.pluginManager.plugins.get(archiveManifest.slug);
          if (existing) {
            const same = !!existing.manifest?.version && existing.manifest.version === archiveManifest.version;
            if (same) { installedSlugs.add(archiveManifest.slug); continue; }
          }
        }
        const installed = await this.pluginManager.installFromZip(archivePath);
        installedOrUpdated = true;
        if (installed?.slug) installedSlugs.add(installed.slug);
      } catch (err: any) {
        const msg = `Failed to install bundled plugin archive "${archivePath}" for theme "${manifest.slug}": ${err.message}`;
        failures.push(msg); this.logger.error(msg);
      }
    }
    if (installedSlugs.size === 0) return;
    if (installedOrUpdated && typeof this.pluginManager.discoverPlugins === 'function') await this.pluginManager.discoverPlugins();
    for (const slug of installedSlugs) {
      try { await this.pluginManager.enable(slug); }
      catch (err: any) { const msg = `Bundled plugin "${slug}" installed but failed to enable: ${err.message}`; failures.push(msg); this.logger.error(msg); }
    }
  }

  getBundledPluginArchivePaths(manifest: ThemeManifest, themePath: string): string[] {
    const archives = new Set<string>();
    const addArchive = (p: string) => {
      if (fs.existsSync(p) && fs.statSync(p).isFile() && this.isSupportedPluginArchive(p)) archives.add(p);
    };
    const declared = (manifest as any).bundledPlugins;
    if (Array.isArray(declared)) {
      for (const entry of declared) {
        if (typeof entry !== 'string' || !entry.trim()) { this.logger.warn(`Ignoring invalid bundled plugin entry in theme "${manifest.slug}" manifest.`); continue; }
        const candidate = path.resolve(themePath, entry);
        const rel = path.relative(themePath, candidate);
        if (rel.startsWith('..') || path.isAbsolute(rel)) { this.logger.warn(`Ignoring bundled plugin path outside theme directory: ${entry}`); continue; }
        addArchive(candidate);
      }
    }
    for (const dirName of ['plugins', 'bundled-plugins']) {
      for (const archivePath of this.collectPluginArchiveFiles(path.join(themePath, dirName))) addArchive(archivePath);
    }
    return Array.from(archives);
  }

  findThemeManifestDir(dir: string): string | null {
    if (fs.existsSync(path.join(dir, 'theme.json'))) return dir;
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) { const found = this.findThemeManifestDir(full); if (found) return found; }
    }
    return null;
  }

  isZipArchive(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.zip') return true;
    if (ext === '.tar' || ext === '.tgz' || ext === '.gz') return false;
    try {
      const fd = fs.openSync(filePath, 'r');
      try { const h = Buffer.alloc(4); const n = fs.readSync(fd, h, 0, 4, 0); return n >= 2 && h[0] === 0x50 && h[1] === 0x4b; } finally { fs.closeSync(fd); }
    } catch { return false; }
  }

  private collectPluginArchiveFiles(rootDir: string): string[] {
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) return [];
    const files: string[] = [];
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(rootDir, entry.name);
      if (entry.isDirectory()) files.push(...this.collectPluginArchiveFiles(abs));
      else if (entry.isFile() && this.isSupportedPluginArchive(abs)) files.push(abs);
    }
    return files;
  }

  private async readBundledPluginManifest(archivePath: string): Promise<{ slug: string; version?: string } | null> {
    try {
      if (this.isZipArchive(archivePath)) {
        const zip = new AdmZip(archivePath);
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('manifest.json')) continue;
          const parsed = JSON.parse(entry.getData().toString('utf8'));
          const slug = String(parsed?.slug || '').trim();
          const version = String(parsed?.version || '').trim();
          if (slug) return { slug, version: version || undefined };
        }
        return null;
      }

      if (!this.isSupportedPluginArchive(archivePath)) return null;
      const tempDir = fs.mkdtempSync(path.join(path.dirname(archivePath), '.bundled-plugin-manifest-'));
      try {
        await BackupService.restore(archivePath, tempDir);
        const manifestDir = this.findThemeManifestDir(tempDir);
        if (!manifestDir) return null;
        const parsed = JSON.parse(fs.readFileSync(path.join(manifestDir, 'manifest.json'), 'utf8'));
        const slug = String(parsed?.slug || '').trim();
        const version = String(parsed?.version || '').trim();
        return slug ? { slug, version: version || undefined } : null;
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch { return null; }
  }

  private isSupportedPluginArchive(filePath: string): boolean {
    const normalized = filePath.toLowerCase();
    return normalized.endsWith('.zip') || normalized.endsWith('.tar.gz') || normalized.endsWith('.tgz');
  }

  moveDir(src: string, dest: string) {
    for (const file of fs.readdirSync(src)) {
      const s = path.join(src, file), d = path.join(dest, file);
      if (fs.statSync(s).isDirectory()) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); this.moveDir(s, d); }
      else { try { fs.renameSync(s, d); } catch { fs.copyFileSync(s, d); fs.unlinkSync(s); } }
    }
  }
}
