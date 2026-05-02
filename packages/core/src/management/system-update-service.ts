import fs from 'fs';
import path from 'path';
import { BackupService } from './backup-service';
import { Logger } from '../logging';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import semver from 'semver';
import crypto from 'crypto';
import { ProjectPaths } from '../config/paths';
import { SafeArchive } from '../security/safe-archive';

export class SystemUpdateService {
  private static logger = new Logger({ namespace: 'SystemUpdate' });
  private static client = new MarketplaceClient();

  private static resolveInstalledVersion(): string {
    const rootDir = ProjectPaths.getProjectRoot();
    const candidatePaths = [
      path.resolve(rootDir, 'packages/core/package.json'),
      path.resolve(rootDir, 'packages/admin/package.json'),
      path.resolve(rootDir, 'packages/api/package.json'),
      path.resolve(rootDir, 'package.json'),
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
    try {
      const marketplaceData = await this.client.fetch();
      
      if (!marketplaceData.core) return null;

      const currentVersion = this.resolveInstalledVersion();

      return {
        current: currentVersion,
        latest: marketplaceData.core.version,
        hasUpdate: semver.gt(marketplaceData.core.version, currentVersion),
        downloadUrl: marketplaceData.core.downloadUrl,
        lastUpdated: marketplaceData.core.lastUpdated
      };
    } catch (err: any) {
      this.logger.error(`Failed to check for updates: ${err.message}`);
      throw err;
    }
  }

  static async applyUpdate() {
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
    this.logger.info(`Framework Core successfully updated to v${resolvedVersion}. A system restart may be required.`);
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
