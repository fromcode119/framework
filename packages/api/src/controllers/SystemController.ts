import { Request, Response } from 'express';
import { PluginManager } from '@fromcode/core';
import { count, sql, systemLogs, desc } from '@fromcode/database';
import { RESTController } from '../rest-controller';

export class SystemController {
  private db: any;

  constructor(private manager: PluginManager, private restController: RESTController) {
    this.db = (manager as any).db.drizzle;
  }

  async getAdminMetadata(req: Request, res: Response) {
    res.json(this.manager.getAdminMetadata());
  }

  async getStats(req: Request, res: Response) {
    const collections = this.manager.getCollections();
    const stats = await Promise.all(collections.map(async (c) => {
      try {
        const result = await this.db.select({ total: count() }).from(sql`${sql.identifier(c.slug)}`);
        return {
          slug: c.slug,
          name: c.name || c.slug,
          count: Number(result[0].total),
          system: !!(c as any).system,
          priority: (c as any).priority || 100
        };
      } catch (e) {
        return { slug: c.slug, count: 0, error: true };
      }
    }));
    res.json(stats);
  }

  async getActivity(req: Request, res: Response) {
    const collections = this.manager.getCollections();
    await this.restController.getGlobalActivity(collections, req, res);
  }

  async getLogs(req: Request, res: Response) {
    try {
      const logs = await this.db.select().from(systemLogs).orderBy(desc(systemLogs.timestamp)).limit(100);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }

  async getI18n(req: Request, res: Response) {
    const locale = (req.query.locale as string) || 'en';
    const translations = (this.manager as any).i18n.translations;
    const localeMap = translations.get(locale) || translations.get('en') || {};
    const activeSlugs = new Set(this.manager.getPlugins().filter(p => p.state === 'active').map(p => p.manifest.slug));
    
    const filteredMap: any = {};
    for (const [slug, data] of Object.entries(localeMap)) {
      if (activeSlugs.has(slug)) filteredMap[slug] = data;
    }
    res.json(filteredMap);
  }
}
