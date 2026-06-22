import path from 'path';
import fs from 'fs';
import { Logger } from '../logging';
import { BackupService } from '../management/backup-service';
import { SafeArchive } from '../security/safe-archive';
import { MarketplaceClient } from '@fromcode119/marketplace-client';
import type { AppearanceManifest } from './appearance-manifest.interfaces';

/**
 * Installs an admin appearance package (marketplace download or uploaded zip) into the appearances
 * dir (APPEARANCE_DIR, bind-mounted). Appearances are presentation bundles — no dependencies, seeds,
 * or bundled plugins — so this is a lean download → unpack, much smaller than the theme installer.
 * Once landed, the admin's AppearanceRuntimeLoader picks the bundle up at runtime.
 */
export class AppearanceInstallerService {
  constructor(
    private readonly logger: Logger,
    private readonly appearancesRoot: string,
    private readonly client: MarketplaceClient,
  ) {}

  async installAppearance(pkg: { slug: string; downloadUrl: string }): Promise<AppearanceManifest> {
    const slug = String(pkg?.slug || '').trim();
    if (!slug) throw new Error('Appearance install requires a slug.');
    const downloadUrl = this.client.resolveDownloadUrl(pkg.downloadUrl);
    this.logger.info(`Installing appearance "${slug}" from ${downloadUrl}...`);
    const tempDir = path.join(this.appearancesRoot, `.tmp-install-${slug}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      await BackupService.downloadAndExtract(downloadUrl, tempDir);
      return this.finalize(tempDir, slug);
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async installFromUrl(url: string): Promise<AppearanceManifest> {
    const trimmed = String(url || '').trim();
    if (!trimmed) throw new Error('Appearance install requires a URL.');
    this.logger.info(`Installing appearance from URL ${trimmed}...`);
    const tempDir = path.join(this.appearancesRoot, `.tmp-url-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      await BackupService.downloadAndExtract(trimmed, tempDir);
      return this.finalize(tempDir, '');
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async installFromZip(filePath: string): Promise<AppearanceManifest> {
    const tempDir = path.join(path.dirname(filePath), `appearance-ext-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      if (this.isZipArchive(filePath)) {
        SafeArchive.extractZip(filePath, tempDir);
      } else {
        await BackupService.restore(filePath, tempDir);
      }
      return this.finalize(tempDir, '');
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {
        this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${(e as Error).message}`);
      }
    }
  }

  private finalize(extractedDir: string, expectedSlug: string): AppearanceManifest {
    const contentDir = this.findManifestDir(extractedDir);
    if (!contentDir) throw new Error('Invalid appearance: appearance.json not found in the archive.');
    const manifest: AppearanceManifest = JSON.parse(fs.readFileSync(path.join(contentDir, 'appearance.json'), 'utf8'));
    const slug = String(manifest?.slug || expectedSlug || '').trim();
    if (!slug) throw new Error('Invalid appearance: missing "slug" in appearance.json.');
    const targetDir = path.join(this.appearancesRoot, slug);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });
    this.moveDir(contentDir, targetDir);
    this.logger.info(`Appearance "${slug}" installed to ${targetDir}.`);
    return manifest;
  }

  private findManifestDir(dir: string): string | null {
    if (fs.existsSync(path.join(dir, 'appearance.json'))) return dir;
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        const found = this.findManifestDir(full);
        if (found) return found;
      }
    }
    return null;
  }

  private isZipArchive(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.zip') return true;
    if (ext === '.tar' || ext === '.tgz' || ext === '.gz') return false;
    try {
      const fd = fs.openSync(filePath, 'r');
      try {
        const h = Buffer.alloc(4);
        const n = fs.readSync(fd, h, 0, 4, 0);
        return n >= 2 && h[0] === 0x50 && h[1] === 0x4b;
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return false;
    }
  }

  private moveDir(src: string, dest: string): void {
    for (const file of fs.readdirSync(src)) {
      const s = path.join(src, file);
      const d = path.join(dest, file);
      if (fs.statSync(s).isDirectory()) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        this.moveDir(s, d);
      } else {
        try { fs.renameSync(s, d); } catch { fs.copyFileSync(s, d); fs.unlinkSync(s); }
      }
    }
  }
}
