import { Request, Response } from 'express';
import { ThemeManager, Logger } from '@fromcode119/core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { BackupService } from '@fromcode119/core';

export class ThemeController {
  private logger = new Logger({ namespace: 'theme-controller' });

  constructor(private manager: ThemeManager) {}

  async list(req: Request, res: Response) {
    res.json(this.manager.getThemes());
  }

  async checkUpdate(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      const result = await this.manager.checkForUpdates(slug);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getMarketplace(req: Request, res: Response) {
    try {
      const themes = await this.manager.getMarketplaceThemes();
      res.json({ themes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async install(req: Request, res: Response) {
    const { slug } = req.params;
    const { version, url } = req.query;
    const { url: bodyUrl } = req.body;

    const downloadUrl = (url as string) || (bodyUrl as string);

    try {
      if (downloadUrl) {
         this.logger.info(`Installing theme "${slug}" from direct URL: ${downloadUrl}`);
         await this.manager.installTheme({ slug, downloadUrl });
         return res.json({ success: true, mode: 'direct' });
      }

      const themes = await this.manager.getMarketplaceThemes();
      const pkg = themes.find((t: any) =>
        t.slug === slug && (!version || t.version === version)
      );
      if (!pkg) return res.status(404).json({ error: `Theme ${slug} ${version ? 'v'+version : ''} not found in marketplace` });

      await this.manager.installTheme(pkg);
      res.json({ success: true, mode: 'marketplace' });
    } catch (err: any) {
      this.logger.error(`Failed to install theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
      const manifest = await this.manager.installFromZip(req.file.path);
      res.json({ success: true, manifest });
    } catch (err: any) {
      this.logger.error(`Failed to upload theme: ${err.message}`);
      res.status(500).json({ error: err.message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async inspectUpload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
      const info = await this.inspectThemeArchive(req.file.path, req.file.originalname);
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid theme archive' });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async activate(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await this.manager.activateTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async disable(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await this.manager.disableTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async reset(req: Request, res: Response) {
    const { slug } = req.params;
    const runSeeds = req.body?.runSeeds !== false;
    const resetConfig = req.body?.resetConfig === true;

    try {
      await this.manager.resetTheme(slug, { runSeeds, resetConfig });
      res.json({ success: true, runSeeds, resetConfig });
    } catch (err: any) {
      this.logger.error(`Failed to reset theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async getConfig(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const config = await this.manager.getThemeConfig(slug);
      res.json({ success: true, config });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async saveConfig(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const config = req.body;
      await this.manager.saveThemeConfig(slug, config);
      res.json({ success: true, message: `Theme ${slug} configuration saved` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await this.manager.deleteTheme(slug);
      res.json({ success: true });
    } catch (err: any) {
      this.logger.error(`Failed to delete theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async servePublicAssets(req: Request, res: Response) {
    this.serveAssetDirectory(req, res, 'public');
  }

  async serveAssets(req: Request, res: Response) {
    this.serveAssetDirectory(req, res, 'ui');
  }

  private serveAssetDirectory(req: Request, res: Response, directory: 'public' | 'ui') {
    const { slug } = req.params;
    const theme = this.manager.getThemes().find(t => t.slug === slug);
    if (!theme) return res.status(404).end();

    const requestedPath = String((req.params as any)[0] || '').trim();
    if (!requestedPath) {
      return res.status(404).end();
    }

    const themeDir = this.manager.getThemeDirectory(slug);
    const assetRoot = path.resolve(themeDir, directory);
    const absolutePath = path.resolve(assetRoot, requestedPath);

    if (!absolutePath.startsWith(`${assetRoot}${path.sep}`) && absolutePath !== assetRoot) {
      return res.status(404).end();
    }

    if (fs.existsSync(absolutePath)) {
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      res.sendFile(absolutePath);
      return;
    }

    res.status(404).end();
  }

  private async inspectThemeArchive(filePath: string, originalFilename?: string) {
    const extractedDir = await this.extractArchiveToTemporaryDirectory(filePath, originalFilename);
    try {
      const themeEntry = this.findManifestPath(extractedDir, 'theme.json');
      if (!themeEntry) {
        throw new Error('Invalid theme package: theme.json not found.');
      }

      let manifest: any;
      try {
        manifest = JSON.parse(fs.readFileSync(themeEntry, 'utf8'));
      } catch {
        throw new Error('Invalid theme package: theme.json is not valid JSON.');
      }

      const slug = String(manifest?.slug || '').trim().toLowerCase();
      if (!slug) {
        throw new Error('Invalid theme package: missing "slug" in theme.json.');
      }

      const existing = this.manager.getThemes().find((theme: any) => theme?.slug === slug);
      const themeRoot = path.dirname(themeEntry);
      const bundledEntries = this.collectBundledPluginArchives(themeRoot).map((archivePath) => ({
        name: path.relative(themeRoot, archivePath).replace(/\\/g, '/'),
        size: fs.statSync(archivePath).size,
      }));

      return {
        slug,
        name: String(manifest?.name || slug),
        version: String(manifest?.version || ''),
        description: String(manifest?.description || ''),
        author: String(manifest?.author || ''),
        hasUiBundle: this.directoryContainsSegment(themeRoot, 'ui'),
        bundledPlugins: bundledEntries,
        existingVersion: existing?.version || null,
        action: existing ? 'update' : 'install',
      };
    } finally {
      fs.rmSync(extractedDir, { recursive: true, force: true });
    }
  }

  private async extractArchiveToTemporaryDirectory(filePath: string, originalFilename?: string): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-theme-inspect-'));
    try {
      if (this.isZipArchive(filePath, originalFilename)) {
        new AdmZip(filePath).extractAllTo(tempDir, true);
      } else if (this.isTarArchive(filePath, originalFilename)) {
        await BackupService.restore(filePath, tempDir);
      } else {
        throw new Error('Unsupported archive format. Upload a .zip or .tar.gz theme package.');
      }
      return tempDir;
    } catch (error) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }
  }

  private findManifestPath(rootDir: string, filename: string): string | null {
    const directPath = path.join(rootDir, filename);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const found = this.findManifestPath(path.join(rootDir, entry.name), filename);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private collectBundledPluginArchives(rootDir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectBundledPluginArchives(absolutePath));
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const normalized = absolutePath.replace(/\\/g, '/').toLowerCase();
      const isBundledDirectory = normalized.includes('/plugins/') || normalized.includes('/bundled-plugins/');
      const isArchive = normalized.endsWith('.zip') || normalized.endsWith('.tar.gz') || normalized.endsWith('.tgz');
      if (isBundledDirectory && isArchive) {
        results.push(absolutePath);
      }
    }
    return results;
  }

  private directoryContainsSegment(rootDir: string, segment: string): boolean {
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const absolutePath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === segment || this.directoryContainsSegment(absolutePath, segment)) {
          return true;
        }
      }
    }
    return false;
  }

  private isZipArchive(filePath: string, originalFilename?: string): boolean {
    const normalizedOriginalName = String(originalFilename || '').trim().toLowerCase();
    if (normalizedOriginalName.endsWith('.zip')) {
      return true;
    }

    try {
      const header = fs.readFileSync(filePath).subarray(0, 4);
      return header.length >= 2 && header[0] === 0x50 && header[1] === 0x4b;
    } catch {
      return false;
    }
  }

  private isTarArchive(filePath: string, originalFilename?: string): boolean {
    const normalizedOriginalName = String(originalFilename || '').trim().toLowerCase();
    return normalizedOriginalName.endsWith('.tar.gz') || normalizedOriginalName.endsWith('.tgz') || normalizedOriginalName.endsWith('.tar') || !this.isZipArchive(filePath, originalFilename);
  }
}