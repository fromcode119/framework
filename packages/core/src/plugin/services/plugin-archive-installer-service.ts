import fs from 'fs';
import path from 'path';
import os from 'os';
import { PluginManifest } from '../../types';
import { BackupService } from '../../management/backup-service';
import { SafeArchive } from '../../security/safe-archive';
import { PluginPackageValidator } from './plugin-package-validator';
import { PluginDependencyInstallerService } from './plugin-dependency-installer-service';

/**
 * PluginArchiveInstallerService
 *
 * Extracts an uploaded plugin archive (.zip / .tar.gz), locates its manifest,
 * and installs it into the plugins root. Extracted from DiscoveryService to keep
 * that class under the size limit; DiscoveryService delegates to this service and
 * keeps the same public method surface (installFromZip / findManifestDir / moveDir).
 */
export class PluginArchiveInstallerService {
  constructor(
    private pluginsRoot: string,
    private dependencyInstaller: PluginDependencyInstallerService,
  ) {}

  public findManifestDir(dir: string): string | null {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        const found = this.findManifestDir(fullPath);
        if (found) return found;
      }
    }
    return null;
  }

  public moveDir(src: string, dest: string) {
    const files = fs.readdirSync(src);
    for (const file of files) {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);

      if (fs.statSync(srcFile).isDirectory()) {
        if (!fs.existsSync(destFile)) fs.mkdirSync(destFile, { recursive: true });
        this.moveDir(srcFile, destFile);
      } else {
        try {
          fs.renameSync(srcFile, destFile);
        } catch (e) {
          fs.copyFileSync(srcFile, destFile);
          fs.unlinkSync(srcFile);
        }
      }
    }
  }

  private isZipArchive(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.zip') return true;
    if (ext === '.tar' || ext === '.tgz' || ext === '.gz') return false;

    // Upload middleware can strip extensions; detect ZIP by signature ("PK").
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

  async installFromZip(filePath: string): Promise<PluginManifest> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-plugin-ext-'));

    try {
      if (this.isZipArchive(filePath)) {
        SafeArchive.extractZip(filePath, tempDir);
      } else {
        try {
          await BackupService.restore(filePath, tempDir);
        } catch (error: any) {
          if (String(error?.message || '').includes('TAR_BAD_ARCHIVE')) {
            throw new Error('Unsupported archive format. Upload a .zip or .tar.gz plugin package.');
          }
          throw error;
        }
      }

      const contentDir = this.findManifestDir(tempDir);
      if (!contentDir) {
        throw new Error('Invalid plugin: manifest.json not found anywhere in the archive.');
      }

      const manifestContent = fs.readFileSync(path.join(contentDir, 'manifest.json'), 'utf8');
      const manifest: PluginManifest = JSON.parse(manifestContent);
      PluginPackageValidator.validateInstalledPackage(contentDir, manifest);
      const targetDir = path.join(this.pluginsRoot, manifest.slug);

      if (fs.existsSync(targetDir)) {
          await BackupService.create(manifest.slug, targetDir, 'plugins');
          fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });

      this.moveDir(contentDir, targetDir);
      await this.dependencyInstaller.ensureInstalled(targetDir);
      return manifest;
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }
}
