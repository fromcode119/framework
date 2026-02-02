import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PluginManager, Logger } from '@fromcode/core';

export class PluginController {
  private logger = new Logger({ namespace: 'PluginController' });

  constructor(private manager: PluginManager) {}

  async list(req: Request, res: Response) {
    res.json(this.manager.getPlugins().map(p => ({
      ...p.manifest,
      state: p.state,
      path: p.path,
      error: p.error,
      approvedCapabilities: p.approvedCapabilities
    })));
  }

  async active(req: Request, res: Response) {
    const activePlugins = this.manager.getPlugins()
      .filter(p => p.state === 'active')
      .map(p => ({
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

  async registry(req: Request, res: Response) {
    try {
      const registryUrl = process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json';
      this.logger.debug(`Fetching plugin registry from: ${registryUrl}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      try {
        const response = await fetch(registryUrl, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!response.ok) {
          this.logger.warn(`Registry responded with status: ${response.status}`);
          throw new Error(`Registry unavailable`);
        }
        
        const data = await response.json();
        res.json(data);
      } catch (err: any) {
        clearTimeout(timeout);
        throw err;
      }
    } catch (err: any) {
      this.logger.error(`Marketplace registry error: ${err.message}`);
      // Return 200 with empty list or specialized error to avoid breaking UI/Proxy
      res.status(503).json({ 
        error: 'Marketplace registry currently unavailable.',
        message: err.message === 'The user aborted a request.' ? 'Request timed out' : err.message
      });
    }
  }

  async install(req: Request, res: Response) {
    const { slug } = req.params;
    const { version } = req.query;
    this.logger.info(`Installation request received for plugin: ${slug} (version: ${version || 'latest'})`);
    
    try {
      const registryUrl = process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.fromcode.com/registry.json';
      this.logger.debug(`Fetching registry from: ${registryUrl}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s for installation lookup

      const response = await fetch(registryUrl, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`Registry returned status ${response.status}: ${response.statusText}`);
      }
      
      const registryData: any = await response.json();
      
      const pkg = registryData.plugins.find((p: any) => 
        p.slug === slug && (!version || p.version === version)
      );
      
      if (!pkg) {
        this.logger.warn(`Plugin ${slug} not found in registry`);
        return res.status(404).json({ error: `Plugin ${slug} ${version ? 'v'+version : ''} not found` });
      }

      if (pkg.downloadUrl && !pkg.downloadUrl.startsWith('http')) {
        pkg.downloadUrl = new URL(pkg.downloadUrl, registryUrl).toString();
      }
      
      this.logger.info(`Installing ${slug} from ${pkg.downloadUrl}`);
      await this.manager.updatePlugin(slug, pkg);
      
      try {
        // Auto-enable plugin after marketplace installation
        await this.manager.enable(slug);
      } catch (enableErr: any) {
        this.logger.warn(`Plugin ${slug} installed but failed to auto-enable: ${enableErr.message}`);
      }

      this.logger.info(`Successfully installed plugin: ${slug}`);
      res.json({ success: true });
    } catch (err: any) {
      this.logger.error(`Failed to install plugin ${slug}: ${err.message}`, err);
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
