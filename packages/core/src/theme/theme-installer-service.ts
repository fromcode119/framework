import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
/** ThemeInstallerService — handles theme package installation. Extracted from ThemeManager (ARC-007). */

import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { Logger } from '@core/logging';
import type { IThemeManifest } from '@core/theme/interfaces/theme-manifest.interface';
import { BackupService } from '@core/management/backup-service';
import { SafeArchive } from '@core/security/safe-archive';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import { Seeder } from '@core/database/seeder';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { ProjectPaths } from '@core/config/paths';
import { TenantThemePackagePolicy } from '@core/theme/tenant-theme-package-policy';
import { ThemeBundledPluginInstaller } from '@core/theme/theme-bundled-plugin-installer';
import { ThemeTenantPlacement } from '@core/theme/theme-tenant-placement';

export class ThemeInstallerService {
  private readonly bundledPlugins: ThemeBundledPluginInstaller;
  private readonly tenantPlacement: ThemeTenantPlacement;

  constructor(
    private readonly logger: Logger,
    private readonly themesRoot: string,
    private readonly seeder: Seeder,
    /** Resolved per install, so a saved Marketplace URL applies to the next one. */
    private readonly clientFor: () => Promise<MarketplaceClient>,
    private readonly pluginManager: any,
    private readonly discoverThemes: () => Promise<void>,
    private readonly resolveThemeDirectory: (slug: string) => string,
  ) {
    this.bundledPlugins = new ThemeBundledPluginInstaller(
      logger,
      pluginManager,
      (slug) => this.resolveThemeDirectory(slug),
    );
    this.tenantPlacement = new ThemeTenantPlacement(
      discoverThemes,
      (dir) => this.findThemeManifestDir(dir),
      (from, to) => this.moveDir(from, to),
    );
  }

  // --- Public install methods ---

  async installTheme(pkg: any): Promise<void> {
    const { slug, downloadUrl: rawDownloadUrl } = pkg;
    const downloadUrl = (await this.clientFor()).resolveDownloadUrl(rawDownloadUrl);
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

  async installFromZip(filePath: string, themesMap: Map<string, IThemeManifest>): Promise<IThemeManifest> {
    return this.withExtractedArchive(filePath, (tempDir) => this.place(tempDir, themesMap, { keepSource: false }));
  }

  /**
   * Installs a theme UPLOADED BY ONE SITE, into that site's own directory.
   *
   * Deliberately not a flag on the platform path. Almost everything `place` does is wrong here — it
   * targets the shared root, it runs the theme's seeds against the database, and it installs and
   * enables whatever plugins the package declares. None of that may happen for a package the platform
   * never reviewed, so this path does none of it: the files go down and nothing else runs.
   *
   * What it adds instead is the three refusals a shared box needs. `TenantThemePackagePolicy` decides
   * what the package may contain; a slug already taken is refused rather than overwritten, because
   * these slugs are global and `place` would `rm -rf` the holder's directory; and the site's quota is
   * checked against what it already has, because the themes volume is one host directory for every
   * tenant on the machine.
   */
  async installForTenant(
    filePath: string,
    tenantId: string,
    themesMap: Map<string, IThemeManifest>,
    quota: { maxBytes: number; maxThemes: number },
  ): Promise<IThemeManifest> {
    const owner = String(tenantId ?? '').trim();
    if (!owner) throw new Error('A site must be selected to upload a theme.');
    return this.withExtractedArchive(filePath, (tempDir) => this.placeForTenant(tempDir, owner, themesMap, quota));
  }

  /**
   * Extracts an uploaded archive to a scratch directory, hands it over, and always cleans up.
   *
   * Shared so the platform path and the per-site path cannot disagree about what a theme package
   * even is — a difference between them is an archive that installs one way and not the other.
   */
  private async withExtractedArchive<T>(filePath: string, use: (tempDir: string) => Promise<T>): Promise<T> {
    const tempDir = path.join(path.dirname(filePath), `theme-ext-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      if (this.isZipArchive(filePath)) {
        SafeArchive.extractZip(filePath, tempDir);
      } else {
        try {
          await BackupService.restore(filePath, tempDir);
        } catch (error: any) {
          if (String(error?.message || '').includes('TAR_BAD_ARCHIVE')) throw new Error('Unsupported archive format. Upload a .zip or .tar.gz theme package.');
          throw error;
        }
      }
      return await use(tempDir);
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {
        this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${(e as Error).message}`);
      }
    }
  }

  /** @see ThemeTenantPlacement.placeForTenant */
  private async placeForTenant(...args: Parameters<ThemeTenantPlacement["placeForTenant"]>): ReturnType<ThemeTenantPlacement["placeForTenant"]> {
    return this.tenantPlacement.placeForTenant(...args);
  }

  /**
   * Installs a theme that is ALREADY a package directory on disk.
   *
   * This is what a locally built theme is. Sources stages a cleaned, checksum-stamped package and
   * an install used to zip that up only for this method's archive twin to unzip it again into the
   * very shape it started in. Nothing about putting a theme in place needs an archive; only
   * getting the directory did.
   *
   * The staged directory is COPIED, not moved: it is the build output, and a download still has to
   * be able to archive it afterwards.
   */
  async installFromDirectory(packageDir: string, themesMap: Map<string, IThemeManifest>): Promise<IThemeManifest> {
    if (!fs.existsSync(packageDir) || !fs.statSync(packageDir).isDirectory()) {
      throw new Error(`Invalid theme package: "${packageDir}" is not a directory.`);
    }
    return this.place(packageDir, themesMap, { keepSource: true });
  }

  /**
   * Puts a theme content directory in place, wherever it came from.
   *
   * The half of an install that is not about archives: find the manifest, back up what is being
   * replaced, put the files there, rediscover, install dependencies. Shared so the archive path and
   * the directory path cannot drift — a difference between them is a theme that installs correctly
   * only one of the two ways.
   */
  private async place(
    sourceDir: string,
    themesMap: Map<string, IThemeManifest>,
    options: { keepSource: boolean },
  ): Promise<IThemeManifest> {
    const contentDir = this.findThemeManifestDir(sourceDir);
    if (!contentDir) throw new Error('Invalid theme: theme.json not found anywhere in the package.');
    const manifest: IThemeManifest = JSON.parse(fs.readFileSync(path.join(contentDir, 'theme.json'), 'utf8'));
    if (!manifest.slug) throw new Error('Invalid theme: missing "slug" in theme.json.');

    const targetDir = path.join(this.themesRoot, manifest.slug);
    if (fs.existsSync(targetDir)) {
      await BackupService.create(manifest.slug, targetDir, BackupSectionKey.THEMES);
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    if (options.keepSource) {
      fs.cpSync(contentDir, targetDir, { recursive: true });
    } else {
      this.moveDir(contentDir, targetDir);
    }

    await this.discoverThemes();
    const installedManifest = themesMap.get(manifest.slug) || manifest;
    await this.installDependencies(installedManifest);
    return installedManifest;
  }

  async installDependencies(manifest: IThemeManifest, options?: { strict?: boolean }) {
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
            if (existing.state !== PluginState.ACTIVE) await this.pluginManager.enable(depSlug);
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

  async runSeeds(manifest: IThemeManifest) {
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

  /** @see ThemeBundledPluginInstaller.installBundledPlugins */
  installBundledPlugins(...args: Parameters<ThemeBundledPluginInstaller["installBundledPlugins"]>): ReturnType<ThemeBundledPluginInstaller["installBundledPlugins"]> {
    return this.bundledPlugins.installBundledPlugins(...args);
  }

  /** @see ThemeBundledPluginInstaller.getBundledPluginArchivePaths */
  getBundledPluginArchivePaths(...args: Parameters<ThemeBundledPluginInstaller["getBundledPluginArchivePaths"]>): ReturnType<ThemeBundledPluginInstaller["getBundledPluginArchivePaths"]> {
    return this.bundledPlugins.getBundledPluginArchivePaths(...args);
  }

  /** @see ThemeBundledPluginInstaller.findThemeManifestDir */
  findThemeManifestDir(...args: Parameters<ThemeBundledPluginInstaller["findThemeManifestDir"]>): ReturnType<ThemeBundledPluginInstaller["findThemeManifestDir"]> {
    return this.bundledPlugins.findThemeManifestDir(...args);
  }

  /** @see ThemeBundledPluginInstaller.isZipArchive */
  isZipArchive(...args: Parameters<ThemeBundledPluginInstaller["isZipArchive"]>): ReturnType<ThemeBundledPluginInstaller["isZipArchive"]> {
    return this.bundledPlugins.isZipArchive(...args);
  }

  /** @see ThemeBundledPluginInstaller.moveDir */
  moveDir(...args: Parameters<ThemeBundledPluginInstaller["moveDir"]>): ReturnType<ThemeBundledPluginInstaller["moveDir"]> {
    return this.bundledPlugins.moveDir(...args);
  }

}
