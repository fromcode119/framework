import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PluginManager, Logger, parseBoolean } from '@fromcode/core';

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
    const { enabled } = req.body;
    try {
      if (enabled) await this.manager.enable(slug);
      else await this.manager.disable(slug);
      res.json({ success: true, state: enabled ? 'active' : 'inactive' });
    } catch (err: any) {
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
    const db = (this.manager as any).db.drizzle;
    const { systemLogs, eq, desc } = require('@fromcode/database');
    
    try {
      const logs = await db.select()
        .from(systemLogs)
        .where(eq(systemLogs.pluginSlug, slug))
        .orderBy(desc(systemLogs.timestamp))
        .limit(100);
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

  async serveAssets(req: Request, res: Response) {
    const { slug } = req.params;
    const plugin = this.manager.getPlugins().find(p => p.manifest.slug === slug);
    if (!plugin || !plugin.path || plugin.state !== 'active') {
      return res.status(404).json({ error: 'Not found or disabled' });
    }
    const filePath = (req.params as any)[0];
    const absolutePath = path.resolve(plugin.path, 'ui', filePath);
    if (fs.existsSync(absolutePath)) {
      res.sendFile(absolutePath);
    } else {
      res.status(404).end();
    }
  }
}
