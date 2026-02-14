import fs from 'fs';
import path from 'path';
import { BackupService } from './backup-service';
import { Logger } from '../logging/logger';
import { MarketplaceClient } from '@fromcode/marketplace-client';
import semver from 'semver';
import crypto from 'crypto';

export class SystemUpdateService {
  private static logger = new Logger({ namespace: 'SystemUpdate' });
  private static client = new MarketplaceClient();

  private static getFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  private static getProjectRoot(): string {
    let current = process.cwd();
    // Try to find the monorepo root by looking for @fromcode/framework
    while (current !== path.parse(current).root) {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === '@fromcode/framework') {
            return current;
          }
        } catch {
          // Ignore parse errors
        }
      }
      current = path.dirname(current);
    }
    return process.cwd();
  }

  static async checkUpdate() {
    try {
      const marketplaceData = await this.client.fetch();
      
      if (!marketplaceData.core) return null;

      let currentVersion = '0.0.0';
      const rootDir = this.getProjectRoot();
      const pkgPath = path.resolve(rootDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        currentVersion = pkg.version || '0.0.0';
      }

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

    const rootDir = this.getProjectRoot();
    const tempDir = path.resolve(rootDir, `.tmp-system-update-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      await BackupService.downloadAndExtract(downloadUrl, tempDir);
      
      this.logger.info(`Applying update files to system root: ${rootDir}`);
      this.moveDir(tempDir, rootDir);
      
      this.logger.info(`Framework Core successfully updated to v${status.latest}. A system restart may be required.`);
      return { success: true, version: status.latest };
    } catch (err: any) {
      this.logger.error(`Update failed: ${err.message}`);
      throw err;
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
