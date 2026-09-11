import fs from 'fs';
import path from 'path';
import { BackupService } from '@core/management/backup-service';
import { Logger } from '@core/logging';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import semver from 'semver';
import crypto from 'crypto';
import { ProjectPaths } from '@core/config/paths';
import { SafeArchive } from '@core/security/safe-archive';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { PluginRuntimeRestartService } from '@core/plugin/services/runtime/plugin-runtime-restart-service';
import { FrameworkReleaseSource } from '@core/management/framework-release-source';
import { DeploymentKind } from '@core/management/deployment-kind';

export class SystemUpdateService {
  private static logger = new Logger({ namespace: 'SystemUpdate' });
  private static client = new MarketplaceClient();

  /** Marketplace client built with the resolved URL (env ?? `_system_meta` ?? default). */
  private static async resolveClient(): Promise<MarketplaceClient> {
    const url = await PlatformSettingsService.resolve(
      process.env.MARKETPLACE_URL,
      PlatformSettingsService.KEY.MARKETPLACE_URL,
    );
    return new MarketplaceClient(url || undefined);
  }

  private static resolveInstalledVersion(): string {
    const rootDir = ProjectPaths.getProjectRoot();
    // The framework ROOT package (@fromcode119/framework) is the canonical engine version — it is what
    // gets bumped on release and what the registry compares against. Individual packages/* may lag, so
    // read the root FIRST; otherwise the update check compares against a stale package version and can
    // offer an OLDER registry release as an "upgrade" (a silent downgrade).
    const rootPkgPath = path.resolve(rootDir, 'package.json');
    try {
      if (fs.existsSync(rootPkgPath)) {
        const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8')) as { name?: string; version?: string };
        const version = String(rootPkg.version || '').trim();
        if (rootPkg.name === '@fromcode119/framework' && version && semver.valid(version)) {
          return version;
        }
      }
    } catch { /* fall through to package fallbacks */ }

    const candidatePaths = [
      path.resolve(rootDir, 'packages/core/package.json'),
      path.resolve(rootDir, 'packages/admin/package.json'),
      path.resolve(rootDir, 'packages/api/package.json'),
      rootPkgPath,
    ];

    for (const candidatePath of candidatePaths) {
      if (!fs.existsSync(candidatePath)) {
        continue;
      }

      try {
        const packageJson = JSON.parse(fs.readFileSync(candidatePath, 'utf8')) as { version?: string };
        const version = String(packageJson.version || '').trim();
        if (version && semver.valid(version)) {
          return version;
        }
      } catch {
        continue;
      }
    }

    return '0.0.0';
  }

  private static getFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  static async checkUpdate() {
    const currentVersion = this.resolveInstalledVersion();
    try {
      this.client = await this.resolveClient();
      const marketplaceData = await this.client.fetch();

      if (marketplaceData.core) {
        return {
          current: currentVersion,
          latest: marketplaceData.core.version,
          hasUpdate: semver.gt(marketplaceData.core.version, currentVersion),
          downloadUrl: marketplaceData.core.downloadUrl,
          lastUpdated: marketplaceData.core.lastUpdated,
          canApplyInPlace: !DeploymentKind.isImage,
        };
      }
    } catch (err: any) {
      // Not fatal on its own: a deployment with no marketplace is the NORMAL case, and the framework
      // still knows where its own releases are published.
      this.logger.warn(`Marketplace did not answer, falling back to the framework's releases: ${err.message}`);
    }

    return this.checkFrameworkReleases(currentVersion);
  }

  /**
   * The fallback: the framework's own published releases.
   *
   * Without it, a deployment that has no marketplace could not tell "no newer version" from "the
   * check broke" — the screen reported a failed check and an unknown latest version forever, which
   * is the least useful of the three possible answers.
   */
  private static async checkFrameworkReleases(currentVersion: string) {
    const latest = await FrameworkReleaseSource.latestVersion();
    if (!latest) {
      this.logger.warn('No update source could be reached: no marketplace, and no framework repository configured.');
      return null;
    }

    return {
      current: currentVersion,
      latest,
      hasUpdate: semver.valid(latest) ? semver.gt(latest, currentVersion) : false,
      downloadUrl: '',
      lastUpdated: '',
      source: await FrameworkReleaseSource.repository(),
      canApplyInPlace: !DeploymentKind.isImage,
      // What each pending version actually changed, so the operator is not agreeing to a number.
      releases: await FrameworkReleaseSource.pending(currentVersion),
    };
  }

  static async applyUpdate() {
    /**
     * Refused before anything is touched. The old failure was a half-done one: it created a backup
     * directory, failed on permissions, and reported "Pre-update backup failed" — which reads as a
     * transient problem to retry rather than as a thing this deployment cannot do at all.
     */
    if (DeploymentKind.isImage) {
      throw new Error(
        'This installation runs from a published image, so it cannot update its own files. Deploy the newer image instead.',
      );
    }

    const status = await this.checkUpdate();
    if (!status || !status.hasUpdate) {
      throw new Error('No update available');
    }

    const downloadUrl = this.client.resolveDownloadUrl(status.downloadUrl);
    
    this.logger.info(`Starting System Update from v${status.current} to v${status.latest}...`);

    try {
      this.logger.info('Creating pre-update system backup...');
      const backupPath = await BackupService.createSystemBackup();
      this.logger.info(`Backup created at: ${backupPath}`);
    } catch (err: any) {
      this.logger.error(`Backup failed: ${err.message}. Aborting update for safety.`);
      throw new Error(`Pre-update backup failed: ${err.message}`);
    }

    const rootDir = ProjectPaths.getProjectRoot();
    const tempDir = this.createTemporaryUpdateDirectory(rootDir);

    try {
      await BackupService.downloadAndExtract(downloadUrl, tempDir);
      return await this.applyPreparedUpdate(tempDir, rootDir, status.latest);
    } catch (err: any) {
      this.logger.error(`Update failed: ${err.message}`);
      throw err;
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  static async applyArchive(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Core update archive does not exist: ${filePath}`);
    }

    const rootDir = ProjectPaths.getProjectRoot();
    this.logger.info(`Starting local Framework Core update from archive: ${filePath}`);

    try {
      this.logger.info('Creating pre-update system backup...');
      const backupPath = await BackupService.createSystemBackup();
      this.logger.info(`Backup created at: ${backupPath}`);
    } catch (err: any) {
      this.logger.error(`Backup failed: ${err.message}. Aborting update for safety.`);
      throw new Error(`Pre-update backup failed: ${err.message}`);
    }

    const tempDir = this.createTemporaryUpdateDirectory(rootDir);

    try {
      await this.extractArchiveToDirectory(filePath, tempDir);
      return await this.applyPreparedUpdate(tempDir, rootDir);
    } catch (err: any) {
      this.logger.error(`Local core archive update failed: ${err.message}`);
      throw err;
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private static createTemporaryUpdateDirectory(rootDir: string): string {
    const tempDir = path.resolve(rootDir, `.tmp-system-update-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  }

  private static async applyPreparedUpdate(tempDir: string, rootDir: string, version?: string) {
    this.logger.info(`Applying update files to system root: ${rootDir}`);
    this.moveDir(tempDir, rootDir);
    const resolvedVersion = version || this.resolveInstalledVersion();
    // Schedule an automatic restart so the new core code is actually loaded (the running process
    // still holds the old core in memory). process.exit → the container's restart policy brings it
    // back; honors the same FROMCODE_DISABLE_PLUGIN_RUNTIME_RESTART / test guards as plugin updates.
    this.logger.info(`Framework Core successfully updated to v${resolvedVersion}. Scheduling restart to load it.`);
    new PluginRuntimeRestartService(this.logger).scheduleRestart(`Framework Core updated to v${resolvedVersion}.`);
    return { success: true, version: resolvedVersion };
  }

  private static async extractArchiveToDirectory(filePath: string, targetDir: string): Promise<void> {
    const normalized = filePath.toLowerCase();
    if (normalized.endsWith('.zip')) {
      SafeArchive.extractZip(filePath, targetDir);
      return;
    }

    if (normalized.endsWith('.tar.gz') || normalized.endsWith('.tgz')) {
      await BackupService.restore(filePath, targetDir);
      return;
    }

    throw new Error('Unsupported core archive format. Upload a .zip or .tar.gz core package.');
  }

  private static moveDir(src: string, dest: string) {
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      // Skip node_modules and hidden git files
      if (item === 'node_modules' || item === '.git') continue;

      if (fs.statSync(srcPath).isDirectory()) {
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
        this.moveDir(srcPath, destPath);
      } else {
        // Smart Update: Only overwrite if content actually changed
        const srcHash = this.getFileHash(srcPath);
        const destHash = this.getFileHash(destPath);

        if (srcHash !== destHash) {
          try {
            fs.renameSync(srcPath, destPath);
          } catch (e) {
            fs.copyFileSync(srcPath, destPath);
            fs.unlinkSync(srcPath);
          }
        }
      }
    }
  }
}
