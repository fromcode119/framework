import fs from 'fs';
import path from 'path';
import { BackupService } from './backup';
import { Logger } from '../logging/logger';
import semver from 'semver';
import crypto from 'crypto';

export class SystemUpdateService {
  private static logger = new Logger({ namespace: 'SystemUpdate' });

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
    const registryUrl = process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json';
    try {
      const response = await fetch(registryUrl);
      if (!response.ok) throw new Error(`Registry unavailable`);
      const registry: any = await response.json();
      
      if (!registry.core) return null;

      let currentVersion = '0.0.0';
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        currentVersion = pkg.version || '0.0.0';
      }

      return {
        current: currentVersion,
        latest: registry.core.version,
        hasUpdate: semver.gt(registry.core.version, currentVersion),
        downloadUrl: registry.core.downloadUrl,
        lastUpdated: registry.core.lastUpdated
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

    const registryUrl = process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json';
    const downloadUrl = status.downloadUrl.startsWith('http') 
        ? status.downloadUrl 
        : new URL(status.downloadUrl, registryUrl).toString();
    
    this.logger.info(`Starting System Update from v${status.current} to v${status.latest}...`);

    try {
      this.logger.info('Creating pre-update system backup...');
      const backupPath = await BackupService.createSystemBackup();
      this.logger.info(`Backup created at: ${backupPath}`);
    } catch (err: any) {
      this.logger.error(`Backup failed: ${err.message}. Aborting update for safety.`);
      throw new Error(`Pre-update backup failed: ${err.message}`);
    }

    const tempDir = path.resolve(process.cwd(), `.tmp-system-update-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      await BackupService.downloadAndExtract(downloadUrl, tempDir);
      
      this.logger.info('Applying update files to system root...');
      this.moveDir(tempDir, process.cwd());
      
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
