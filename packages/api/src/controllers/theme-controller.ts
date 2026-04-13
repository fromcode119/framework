import { Request, Response } from 'express';
import { ThemeManager, Logger } from '@fromcode119/core';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

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
      const info = this.inspectThemeArchive(req.file.path);
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

  async serveAssets(req: Request, res: Response) {
    const { slug } = req.params;
    const theme = this.manager.getThemes().find(t => t.slug === slug);
    if (!theme) return res.status(404).end();

    const filePath = (req.params as any)[0];
    const themeDir = (this.manager as any).getThemeDirectory
      ? (this.manager as any).getThemeDirectory(slug)
      : path.resolve((this.manager as any).themesRoot, slug);
    const absolutePath = path.resolve(themeDir, 'ui', filePath);
    
    if (fs.existsSync(absolutePath)) {
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      res.sendFile(absolutePath);
    } else {
      res.status(404).end();
    }
  }

  private inspectThemeArchive(filePath: string) {
    if (!this.isZipArchive(filePath)) {
      throw new Error('Unsupported archive format. Upload a .zip theme package.');
    }

    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const themeEntry = entries.find((entry) =>
      !entry.isDirectory && entry.entryName.toLowerCase().endsWith('/theme.json')
    ) || entries.find((entry) =>
      !entry.isDirectory && entry.entryName.toLowerCase() === 'theme.json'
    );

    if (!themeEntry) {
      throw new Error('Invalid theme package: theme.json not found.');
    }

    let manifest: any;
    try {
      manifest = JSON.parse(themeEntry.getData().toString('utf8'));
    } catch {
      throw new Error('Invalid theme package: theme.json is not valid JSON.');
    }

    const slug = String(manifest?.slug || '').trim().toLowerCase();
    if (!slug) {
      throw new Error('Invalid theme package: missing "slug" in theme.json.');
    }

    const existing = this.manager.getThemes().find((theme: any) => theme?.slug === slug);
    const themeManifestPath = themeEntry.entryName.replace(/\\/g, '/');
    const themeRoot = themeManifestPath.includes('/') ? themeManifestPath.slice(0, themeManifestPath.lastIndexOf('/') + 1) : '';

    const bundledZipEntries = entries
      .filter((entry) => {
        if (entry.isDirectory) return false;
        const normalized = entry.entryName.replace(/\\/g, '/').toLowerCase();
        if (!normalized.endsWith('.zip')) return false;
        return (
          normalized.includes('/plugins/') ||
          normalized.includes('/bundled-plugins/') ||
          normalized.startsWith('plugins/') ||
          normalized.startsWith('bundled-plugins/')
        );
      })
      .map((entry) => entry.entryName.replace(/\\/g, '/'));

    const declaredBundled = Array.isArray(manifest?.bundledPlugins)
      ? manifest.bundledPlugins
          .filter((item: any) => typeof item === 'string')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
      : [];

    const normalizedBundledPaths = new Set<string>();
    for (const declared of declaredBundled) {
      const normalizedDeclared = path.posix.normalize(declared).replace(/^\.?\//, '');
      normalizedBundledPaths.add(`${themeRoot}${normalizedDeclared}`);
      normalizedBundledPaths.add(normalizedDeclared);
    }
    for (const zipPath of bundledZipEntries) normalizedBundledPaths.add(zipPath);

    const bundledPlugins = Array.from(normalizedBundledPaths)
      .filter((entry) => entry.toLowerCase().endsWith('.zip'))
      .sort()
      .map((archivePath) => {
        const matchedEntry = entries.find(
          (entry) => !entry.isDirectory && entry.entryName.replace(/\\/g, '/') === archivePath
        );
        if (!matchedEntry) {
          return {
            archive: archivePath,
            source: 'manifest',
          };
        }

        const nested = this.inspectNestedPluginArchive(matchedEntry.getData(), archivePath);
        return {
          archive: archivePath,
          source: declaredBundled.some((declared) => archivePath.endsWith(path.posix.normalize(declared).replace(/^\.?\//, '')))
            ? 'manifest'
            : 'directory',
          ...nested,
        };
      });

    return {
      slug,
      name: String(manifest?.name || slug),
      version: String(manifest?.version || '0.0.0'),
      description: String(manifest?.description || ''),
      files: entries.filter((entry) => !entry.isDirectory).length,
      dependencies: Object.keys(manifest?.dependencies || {}),
      bundledPlugins,
      existing: existing
        ? {
            installed: true,
            version: String(existing?.version || ''),
            state: String(existing?.state || 'inactive'),
          }
        : { installed: false },
    };
  }

  private inspectNestedPluginArchive(buffer: Buffer, archive: string) {
    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const manifestEntry = entries.find((entry) =>
        !entry.isDirectory && entry.entryName.toLowerCase().endsWith('/manifest.json')
      ) || entries.find((entry) =>
        !entry.isDirectory && entry.entryName.toLowerCase() === 'manifest.json'
      );
      if (!manifestEntry) return {};

      const parsed = JSON.parse(manifestEntry.getData().toString('utf8'));
      const slug = String(parsed?.slug || '').trim();
      const version = String(parsed?.version || '').trim();
      const name = String(parsed?.name || '').trim();

      return {
        pluginSlug: slug || undefined,
        pluginName: name || undefined,
        pluginVersion: version || undefined,
      };
    } catch {
      this.logger.warn(`Failed to inspect bundled plugin archive ${archive}`);
      return {};
    }
  }

  private isZipArchive(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.zip') return true;
    if (ext === '.tar' || ext === '.tgz' || ext === '.gz') return false;

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
}