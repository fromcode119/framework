import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PluginManager, Logger, parseBoolean } from '@fromcode119/core';
import AdmZip from 'adm-zip';

export class PluginController {
  private logger = new Logger({ namespace: 'plugin-controller' });

  constructor(private manager: PluginManager) {}

  async list(req: Request, res: Response) {
    const shouldRefresh = parseBoolean(req.query.refresh);

    if (shouldRefresh) {
      try {
        await this.manager.discoverPlugins();
      } catch (err: any) {
        this.logger.error(`Plugin discovery refresh failed: ${err.message}`);
      }
    }

    res.json(this.manager.getSortedPlugins().map(p => ({
      ...p.manifest,
      state: p.state,
      path: p.path,
      error: p.error,
      approvedCapabilities: p.approvedCapabilities,
      healthStatus: p.healthStatus || 'healthy'
    })));
  }

  async active(req: Request, res: Response) {
    const activePlugins = this.manager.getSortedPlugins(
      this.manager.getPlugins().filter(p => p.state === 'active')
    ).map(p => ({
        slug: p.manifest.slug,
        version: p.manifest.version,
        name: p.manifest.name,
        capabilities: p.manifest.capabilities,
        ui: {
          ...(p.manifest.ui || {}),
          headInjections: this.manager.getHeadInjections(p.manifest.slug)
        }
      }));
    res.json(activePlugins);
  }

  async toggle(req: Request, res: Response) {
    const { slug } = req.params;
    const { enabled, force, recursive } = req.body;
    try {
      if (enabled) {
        await this.manager.enable(slug, { 
          force: parseBoolean(force), 
          recursive: parseBoolean(recursive) 
        });
      } else {
        await this.manager.disable(slug);
      }
      res.json({ success: true, state: enabled ? 'active' : 'inactive' });
    } catch (err: any) {
      if (err.message.startsWith('DEPENDENCY_ISSUES:')) {
        try {
          const json = err.message.replace('DEPENDENCY_ISSUES: ', '');
          const issues = JSON.parse(json);
          return res.status(409).json({ 
            code: 'DEPENDENCY_REQUIRED',
            message: 'One or more required plugins are missing or inactive.',
            issues,
            plugin: slug
          });
        } catch (e) {}
      }

      const status = err.message.toLowerCase().includes('not found') || 
                     err.message.toLowerCase().includes('missing dependency') ||
                     err.message.toLowerCase().includes('incompatible') ? 400 : 500;
      this.logger.error(`Toggle failed for plugin "${slug}": ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  }

  async getConfig(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
    res.json(plugin.manifest.config || {});
  }

  async saveConfig(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await this.manager.savePluginConfig(slug, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async saveSandboxConfig(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await (this.manager as any).saveSandboxConfig(slug, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      await this.manager.delete(slug);
      res.json({ success: true });
    } catch (err: any) {
      // Differentiate between validation errors (400) and actual server crashes (500)
      const isValidationError = err.message.toLowerCase().includes('cannot delete') || 
                               err.message.toLowerCase().includes('required by') ||
                               err.message.toLowerCase().includes('not found');
      
      const status = isValidationError ? 400 : 500;
      this.logger.error(`Delete failed for plugin "${slug}": ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  }

  async marketplace(req: Request, res: Response) {
    try {
      const plugins = await this.manager.marketplace.fetchCatalog();
      res.json({ plugins }); // Admin UI expects { plugins: [...] }
    } catch (err: any) {
      this.logger.error(`Marketplace error: ${err.message}`);
      res.status(503).json({ 
        error: 'Marketplace currently unavailable.',
        message: err.message
      });
    }
  }

  async install(req: Request, res: Response) {
    const { slug } = req.params;
    this.logger.info(`Installation request received for plugin: ${slug}`);
    
    try {
      const manifest = await this.manager.installOrUpdateFromMarketplace(slug);
      
      // Attempt to enable if not already active
      const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
      if (plugin && plugin.state !== 'active') {
        try {
          await this.manager.enable(slug);
        } catch (enableErr: any) {
          this.logger.warn(`Plugin ${slug} installed but failed to auto-enable: ${enableErr.message}`);
        }
      }

      res.json({ success: true, manifest });
    } catch (err: any) {
      this.logger.error(`Failed to install plugin ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  }

  async logs(req: Request, res: Response) {
    const { slug } = req.params;
    const db = (this.manager as any).db;
    const { systemLogs } = require('@fromcode119/database');
    
    try {
      const logs = await db.find(systemLogs, {
        where: db.eq(systemLogs.pluginSlug, slug),
        orderBy: db.desc(systemLogs.timestamp),
        limit: 100
      });
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
      const manifest = await this.manager.installFromZip(req.file.path);
      // Discover newly added plugin files
      await this.manager.discoverPlugins();
      // Try to auto-enable
      try {
        await this.manager.enable(manifest.slug);
      } catch (enableErr: any) {
        this.logger.warn(`Uploaded plugin ${manifest.slug} failed to auto-enable: ${enableErr.message}`);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async inspectUpload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    try {
      const info = this.inspectPluginArchive(req.file.path);
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid plugin archive' });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  }

  async serveAssets(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin || !plugin.path || plugin.state !== 'active') {
      return res.status(404).json({ error: 'Not found or disabled' });
    }
    const filePath = (req.params as any)[0];
    const absolutePath = path.resolve(plugin.path, 'ui', filePath);
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

  private inspectPluginArchive(filePath: string) {
    if (!this.isZipArchive(filePath)) {
      throw new Error('Unsupported archive format. Upload a .zip plugin package.');
    }

    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const manifestEntry = entries.find((entry) =>
      !entry.isDirectory && entry.entryName.toLowerCase().endsWith('/manifest.json')
    ) || entries.find((entry) =>
      !entry.isDirectory && entry.entryName.toLowerCase() === 'manifest.json'
    );

    if (!manifestEntry) {
      throw new Error('Invalid plugin package: manifest.json not found.');
    }

    let manifest: any;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    } catch {
      throw new Error('Invalid plugin package: manifest.json is not valid JSON.');
    }

    const slug = String(manifest?.slug || '').trim().toLowerCase();
    if (!slug) {
      throw new Error('Invalid plugin package: missing "slug" in manifest.json.');
    }

    const existing = this.manager.getPlugins().find((plugin: any) => plugin?.manifest?.slug === slug);
    const dependencies = Object.keys(manifest?.dependencies || {});
    const peerDependencies = Object.keys(manifest?.peerDependencies || {});
    const hasUiBundle = entries.some((entry) => {
      if (entry.isDirectory) return false;
      const normalized = entry.entryName.replace(/\\/g, '/').toLowerCase();
      return normalized.endsWith('/ui/bundle.js') || normalized === 'ui/bundle.js';
    });

    return {
      slug,
      name: String(manifest?.name || slug),
      version: String(manifest?.version || '0.0.0'),
      description: String(manifest?.description || ''),
      files: entries.filter((entry) => !entry.isDirectory).length,
      hasUiBundle,
      dependencies,
      peerDependencies,
      existing: existing
        ? {
            installed: true,
            version: String(existing?.manifest?.version || ''),
            state: String(existing?.state || 'inactive'),
          }
        : { installed: false },
    };
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
