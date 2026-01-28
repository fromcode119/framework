import { Request, Response } from 'express';
import { ThemeManager, Logger } from '@fromcode/core';
import fs from 'fs';
import path from 'path';

export class ThemeController {
  private logger = new Logger({ namespace: 'ThemeController' });

  constructor(private manager: ThemeManager) {}

  async list(req: Request, res: Response) {
    res.json(this.manager.getThemes());
  }

  async getRegistry(req: Request, res: Response) {
    try {
      const themes = await this.manager.getRegistryThemes();
      res.json({ themes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async install(req: Request, res: Response) {
    const { slug } = req.params;
    const { version } = req.query;
    try {
      const themes = await this.manager.getRegistryThemes();
      const pkg = themes.find((t: any) => 
        t.slug === slug && (!version || t.version === version)
      );
      if (!pkg) return res.status(404).json({ error: `Theme ${slug} ${version ? 'v'+version : ''} not found in registry` });

      await this.manager.installTheme(pkg);
      res.json({ success: true });
    } catch (err: any) {
      this.logger.error(`Failed to install theme ${slug}: ${err.message}`);
      res.status(500).json({ error: err.message });
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

    const themesRoot = (this.manager as any).themesRoot;
    const filePath = (req.params as any)[0];
    const absolutePath = path.resolve(themesRoot, slug, 'ui', filePath);
    
    if (fs.existsSync(absolutePath)) res.sendFile(absolutePath);
    else res.status(404).end();
  }
}
