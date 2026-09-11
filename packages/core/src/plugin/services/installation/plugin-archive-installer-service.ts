import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import { BackupService } from '@core/management/backup-service';
import { SafeArchive } from '@core/security/safe-archive';
import { PluginPackageValidator } from '@core/plugin/services/installation/plugin-package-validator';
import { PluginDependencyInstallerService } from '@core/plugin/services/installation/plugin-dependency-installer-service';

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

  /** Throws when `dir` is a git checkout — an archive install or a delete must never destroy source. */
  static refuseSourceCheckout(dir: string, slug: string, action: 'replace' | 'delete'): void {
    // An EMPTY path must never be checked: `path.join('', '.git')` is the process's working directory,
    // which is the framework checkout itself — every plugin without a recorded path looked like source.
    if (!String(dir || '').trim()) return;
    if (!fs.existsSync(path.join(dir, '.git'))) return;
    throw new Error(
      `Refusing to ${action} plugin "${slug}": its directory is a git checkout (source), not an installed package. `
      + 'Update or remove a source plugin through its repository, not from the admin.',
    );
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

  async installFromZip(filePath: string): Promise<IPluginManifest> {
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

      return await this.place(tempDir, { keepSource: false });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  /**
   * Installs a plugin that is ALREADY a package directory on disk.
   *
   * What a locally built plugin is. Sources stages a cleaned, checksum-stamped package; zipping it
   * so that this method's archive twin could unzip it back into the same shape was the round trip,
   * and the zip was the step where the packaging silently stopped happening.
   *
   * The staged directory is COPIED, not moved: it is the build output, and a download still has to
   * be able to archive it afterwards.
   */
  async installFromDirectory(packageDir: string): Promise<IPluginManifest> {
    if (!fs.existsSync(packageDir) || !fs.statSync(packageDir).isDirectory()) {
      throw new Error(`Invalid plugin package: "${packageDir}" is not a directory.`);
    }
    return this.place(packageDir, { keepSource: true });
  }

  /**
   * Puts a plugin content directory in place, wherever it came from.
   *
   * The half of an install that is not about archives. Shared by both entry points so they cannot
   * drift — a difference between them is a plugin that installs correctly only one of the two ways.
   */
  private async place(sourceDir: string, options: { keepSource: boolean }): Promise<IPluginManifest> {
    const contentDir = this.findManifestDir(sourceDir);
    if (!contentDir) {
      throw new Error('Invalid plugin: manifest.json not found anywhere in the package.');
    }

    const manifestContent = fs.readFileSync(path.join(contentDir, 'manifest.json'), 'utf8');
    const manifest: IPluginManifest = JSON.parse(manifestContent);
    PluginPackageValidator.validateInstalledPackage(contentDir, manifest);
    const targetDir = path.join(this.pluginsRoot, manifest.slug);

    if (fs.existsSync(targetDir)) {
      // A plugin directory that is a git CHECKOUT is somebody's source tree (a developer's mounted
      // plugins folder), not an installed artifact. Replacing it with a packed archive deletes the
      // TypeScript, the tests and the repository metadata — which happened once, from an admin
      // upload over a mounted repo. Source is updated from its repository, never from a package.
      PluginArchiveInstallerService.refuseSourceCheckout(targetDir, manifest.slug, 'replace');
      await BackupService.create(manifest.slug, targetDir, BackupSectionKey.PLUGINS);
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    if (options.keepSource) {
      fs.cpSync(contentDir, targetDir, { recursive: true });
    } else {
      this.moveDir(contentDir, targetDir);
    }

    await this.dependencyInstaller.ensureInstalled(targetDir);
    return manifest;
  }
}
