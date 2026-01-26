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
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
    }
  }

  async registry(req: Request, res: Response) {
    try {
      const registryUrl = process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.framework.local/registry.json';
      const response = await fetch(registryUrl);
      if (!response.ok) throw new Error(`Registry unavailable`);
      res.json(await response.json());
    } catch (err: any) {
      res.status(503).json({ error: 'Marketplace registry currently unavailable.' });
    }
  }

  async install(req: Request, res: Response) {
    const { slug } = req.params;
    try {
      const registryUrl = process.env.MARKETPLACE_REGISTRY_URL || 'http://registry.framework.local/registry.json';
      const response = await fetch(registryUrl);
      const registryData: any = await response.json();
      const pkg = registryData.plugins.find((p: any) => p.slug === slug);
      if (!pkg) return res.status(404).json({ error: 'Plugin not found' });

      if (pkg.downloadUrl && !pkg.downloadUrl.startsWith('http')) {
        pkg.downloadUrl = new URL(pkg.downloadUrl, registryUrl).toString();
      }
      await this.manager.updatePlugin(slug, pkg);
      res.json({ success: true });
    } catch (err: any) {
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
      const pluginsRoot = (this.manager as any).pluginsRoot;
      await (this.manager as any).installFromZip(req.file.path, pluginsRoot);
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
    if (fs.existsSync(absolutePath)) res.sendFile(absolutePath);
    else res.status(404).end();
  }
}
