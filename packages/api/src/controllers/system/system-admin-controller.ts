import { Request, Response } from 'express';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';

export class SystemAdminController {

  constructor(private readonly runtime: SystemControllerRuntime) {}

  /** Global admin search — the command-palette data source. */
  async search(req: Request, res: Response) {
    try {
      res.json(await this.runtime.search.search(req.query?.q));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getThemes(req: Request, res: Response) {
    res.json(this.runtime.themeManager.getThemes());
  }

  async activateTheme(req: Request, res: Response) {
    try {
      await this.runtime.themeManager.activateTheme(req.body.slug);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStats(req: Request, res: Response) {
    const stats = await Promise.all(this.runtime.manager.getCollections().map(async (collection) => {
      try {
        return {
          slug: collection.slug,
          shortSlug: collection.shortSlug || collection.slug,
          count: await this.runtime.db.count(collection.tableName || collection.slug),
          system: !!collection.system,
          hidden: !!collection.admin?.hidden,
          icon: collection.admin?.icon,
          priority: collection.admin?.priority || collection.priority || 100,
          pluginSlug: collection.pluginSlug || 'system',
        };
      } catch {
        return { slug: collection.slug, count: 0, error: true };
      }
    }));
    res.json(stats);
  }

  async getSecurityStats(req: Request, res: Response) {
    try {
      res.json(await this.runtime.manager.getSecuritySummary());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
