import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { BackupService } from '@core/management/backup-service';

/**
 * The plugin archives a theme ships INSIDE its package, and the filesystem work around them.
 *
 * A theme may depend on plugins that are not in any marketplace — the ones written for it. Shipping
 * them in the package is the only way to install a theme that works, and unpacking them is a
 * different job from installing the theme: it reads archives, sniffs manifests out of them, and
 * decides which are even supported.
 *
 * FAILURES ARE COLLECTED, NOT THROWN. A theme whose bundled plugin will not install is still a theme
 * that installed; the caller reports which plugins did not, so an operator can see what is missing
 * rather than being told the whole install failed.
 *
 * Split out of `ThemeInstallerService` (441 lines), which installs the theme itself.
 */
export class ThemeBundledPluginInstaller {
  constructor(
    private readonly logger: any,
    private readonly pluginManager: any,
    private readonly resolveThemeDirectory: (slug: string) => string,
  ) {}

  async installBundledPlugins(manifest: IThemeManifest, failures: string[]) {
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
    if (installedOrUpdated) await this.pluginManager.discoverPlugins();
    for (const slug of installedSlugs) {
      try { await this.pluginManager.enable(slug); }
      catch (err: any) { const msg = `Bundled plugin "${slug}" installed but failed to enable: ${err.message}`; failures.push(msg); this.logger.error(msg); }
    }
  }

  getBundledPluginArchivePaths(manifest: IThemeManifest, themePath: string): string[] {
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

  collectPluginArchiveFiles(rootDir: string): string[] {
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

  async readBundledPluginManifest(archivePath: string): Promise<{ slug: string; version?: string } | null> {
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
    } catch (e) {
      this.logger.warn(`Failed to read manifest from bundled archive "${archivePath}": ${(e as Error).message}`);
      return null;
    }
  }

  isSupportedPluginArchive(filePath: string): boolean {
    const normalized = filePath.toLowerCase();
    return normalized.endsWith('.zip') || normalized.endsWith('.tar.gz') || normalized.endsWith('.tgz');
  }

  moveDir(src: string, dest: string) {
    for (const file of fs.readdirSync(src)) {
      const s = path.join(src, file), d = path.join(dest, file);
      if (fs.statSync(s).isDirectory()) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); this.moveDir(s, d); }
      else { try { fs.renameSync(s, d); } catch { this.logger.debug(`Cross-device move: falling back to copy+delete for ${s}`); fs.copyFileSync(s, d); fs.unlinkSync(s); } }
    }
  }
}
