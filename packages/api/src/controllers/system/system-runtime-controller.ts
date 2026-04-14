import { Request, Response } from 'express';
import { CoercionUtils, SystemUpdateService } from '@fromcode119/core';
import { ResolvedDocResponseService } from '../../services/resolved-doc-response-service';
import { SystemControllerRuntime } from './system-controller-runtime';

export class SystemRuntimeController {
  constructor(private readonly runtime: SystemControllerRuntime) {}

  async getActivity(req: Request, res: Response) {
    return this.runtime.restController.getGlobalActivity(this.runtime.manager.getCollections(), req, res);
  }

  async getShortcodes(req: Request, res: Response) {
    const docs = await this.runtime.shortcodes.getRegisteredShortcodes();
    res.json({ docs, totalDocs: docs.length });
  }

  async renderShortcodes(req: Request, res: Response) {
    try {
      const result = await this.runtime.shortcodes.render(req.body.content, {
        user: (req as any).user,
        maxShortcodes: req.body.maxShortcodes,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getLogs(req: Request, res: Response) {
    try {
      res.json(await this.runtime.system.getLogs({
        page: parseInt(req.query.page as string, 10),
        limit: parseInt(req.query.limit as string, 10),
        search: req.query.search as string,
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAuditLogs(req: Request, res: Response) {
    try {
      res.json(await this.runtime.system.getAuditLogs({
        page: parseInt(req.query.page as string, 10),
        limit: parseInt(req.query.limit as string, 10),
        search: req.query.search as string,
        status: req.query.status as string,
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async checkUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.checkUpdate());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async applyUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.applyUpdate());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDataSources(req: Request, res: Response) {
    try {
      const docs = this.runtime.manager.getCollections().map((collection) => ({
        slug: collection.slug,
        shortSlug: collection.shortSlug || collection.slug,
        label: (collection as any).label || collection.slug,
        hidden: !!collection.admin?.hidden,
      }));
      res.json({ docs, totalDocs: docs.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async queryDataSource(req: Request, res: Response) {
    try {
      const source = String(req.query.source || req.body?.source || req.query.slug || req.body?.slug || '').trim();
      if (!source) {
        return res.status(400).json({ error: 'source is required' });
      }

      const collection = this.runtime.manager.getCollections().find((item: any) => {
        return item.slug === source || item.shortSlug === source || item.unprefixedSlug === source;
      });
      if (!collection) {
        return res.status(404).json({ error: `Unknown data source: ${source}` });
      }

      const mergedQuery = { ...(req.query as any), ...(req.body || {}) } as any;
      delete mergedQuery.source;
      const data = await this.runtime.restController.find(collection, {
        query: mergedQuery,
        user: (req as any).user,
        locale: (req as any).locale,
        headers: req.headers,
        cookies: (req as any).cookies,
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getI18n(req: Request, res: Response) {
    const locale = (req.query.locale as string) || 'en';
    const activeSlugs = new Set(
      this.runtime.manager.getPlugins().filter((plugin) => plugin.state === 'active').map((plugin) => plugin.manifest.slug)
    );
    const translations = (this.runtime.manager as any).i18n.translations.get(locale) || {};
    const filtered: any = {};
    for (const [slug, data] of Object.entries(translations)) {
      if (activeSlugs.has(slug)) {
        filtered[slug] = data;
      }
    }
    res.json(filtered);
  }

  async resolveSlug(req: Request, res: Response) {
    try {
      const slug = req.query.slug as string;
      if (!slug) {
        return res.status(400).json({ error: 'Slug is required' });
      }

      const isAdmin = (req as any).user?.roles?.includes('admin');
      const isPreview = CoercionUtils.toBoolean(req.query.preview) || CoercionUtils.toBoolean(req.query.draft);
      const result = await this.runtime.resolution.resolveSlug(slug, {
        user: (req as any).user,
        preview: isAdmin || isPreview,
        locale: req.query.locale as string,
        fallback_locale: req.query.fallback_locale as string,
        locale_mode: req.query.locale_mode as string,
      });

      if (!result) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(ResolvedDocResponseService.normalizeResult(result));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getEvents(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const handler = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    this.runtime.manager.hooks.on('system:hmr:reload', handler);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      this.runtime.manager.hooks.off('system:hmr:reload', handler);
    });
  }

  async sendTestTelemetryEmail(req: Request, res: Response) {
    try {
      const user = ((req as any).user || {}) as { id?: string | number; email?: string; roles?: string[] };
      const result = await (this.runtime.manager as any).sendTestEmailTelemetry({
        id: user.id,
        email: user.email,
        roles: Array.isArray(user.roles) ? user.roles : [],
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Failed to send telemetry test email' });
    }
  }
}