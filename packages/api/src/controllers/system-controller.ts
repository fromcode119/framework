import { Request, Response } from 'express';
import { PluginManager, ThemeManager, SystemUpdateService } from '@fromcode/core';
import { RESTController } from './rest-controller';
import { ShortcodeService } from '../services/shortcode-service';
import { SystemService } from '../services/system-service';
import { UserManagementService } from '../services/user-management-service';
import { ResolutionService } from '../services/resolution-service';

export class SystemController {
  private db: any;
  private shortcodes: ShortcodeService;
  private system: SystemService;
  private users: UserManagementService;
  private resolution: ResolutionService;

  constructor(private manager: PluginManager, private themeManager: ThemeManager, private restController: RESTController) {
    const dbWrapper = (manager as any).db;
    this.db = dbWrapper.drizzle;
    this.shortcodes = new ShortcodeService(manager, restController);
    this.system = new SystemService(dbWrapper, this.db);
    this.users = new UserManagementService(dbWrapper, manager.auth, manager);
    this.resolution = new ResolutionService(manager, restController);
  }

  async getAdminMetadata(req: Request, res: Response) {
    try {
      const metadata = this.manager.getAdminMetadata() as any;
      const runtimeModules = this.manager.getRuntimeModules();
      const frontendMeta = await this.themeManager.getFrontendMetadata(runtimeModules);

      if (frontendMeta?.activeTheme) {
        metadata.activeTheme = { ...frontendMeta.activeTheme, ui: { ...(frontendMeta.activeTheme.ui || {}), css: [] } };
      }
      if (frontendMeta?.runtimeModules) metadata.runtimeModules = frontendMeta.runtimeModules;

      const settings = await (this.manager as any).db.find('_system_meta');
      const settingsMap: Record<string, any> = {};
      settings.forEach((s: any) => settingsMap[s.key] = s.value);
      metadata.settings = settingsMap;

      res.json(metadata);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getIntegrations(req: Request, res: Response) {
    try {
      const data = await this.manager.integrations.listConfigs();
      res.json({ docs: data, totalDocs: data.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getIntegration(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const integration = await this.manager.integrations.getConfig(type);
      if (!integration) return res.status(404).json({ error: 'Not found' });
      res.json(integration);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async updateIntegration(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const { provider, config } = req.body;
      const updated = await this.manager.integrations.updateConfig(type, provider, config || {});
      res.json({ success: !!updated, integration: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getFrontendMetadata(req: Request, res: Response) {
    res.json(await this.themeManager.getFrontendMetadata(this.manager.getRuntimeModules()));
  }

  async getThemes(req: Request, res: Response) {
    res.json(this.themeManager.getThemes());
  }

  async activateTheme(req: Request, res: Response) {
    try {
      await this.themeManager.activateTheme(req.body.slug);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getStats(req: Request, res: Response) {
    const stats = await Promise.all(this.manager.getCollections().map(async (c) => {
      try {
        return {
          slug: c.slug,
          shortSlug: c.shortSlug || c.slug,
          count: await (this.manager as any).db.count(c.tableName || c.slug),
          system: !!c.system,
          hidden: !!c.admin?.hidden
        };
      } catch {
        return { slug: c.slug, count: 0, error: true };
      }
    }));
    res.json(stats);
  }

  async getSecurityStats(req: Request, res: Response) {
    try {
      res.json(await this.manager.getSecuritySummary());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getActivity(req: Request, res: Response) {
    return this.restController.getGlobalActivity(this.manager.getCollections(), req, res);
  }

  async getShortcodes(req: Request, res: Response) {
    const docs = await this.shortcodes.getRegisteredShortcodes();
    res.json({ docs, totalDocs: docs.length });
  }

  async renderShortcodes(req: Request, res: Response) {
    try {
      const { content, maxShortcodes } = req.body;
      const result = await this.shortcodes.render(content, { user: (req as any).user, maxShortcodes });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getLogs(req: Request, res: Response) {
    try {
      res.json(await this.system.getLogs({
        page: parseInt(req.query.page as string),
        limit: parseInt(req.query.limit as string),
        search: req.query.search as string
      }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getAuditLogs(req: Request, res: Response) {
    try {
      res.json(await this.system.getAuditLogs({
        page: parseInt(req.query.page as string),
        limit: parseInt(req.query.limit as string),
        search: req.query.search as string,
        status: req.query.status as string
      }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getRoles(req: Request, res: Response) {
    try {
      res.json(await this.users.getRoles());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async saveRole(req: Request, res: Response) {
    try {
      await this.users.saveRole(req.params.slug || req.body.slug, req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getRole(req: Request, res: Response) {
    try {
      const role = await this.users.getRole(req.params.slug);
      if (!role) return res.status(404).json({ error: 'Role not found' });
      res.json(role);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async deleteRole(req: Request, res: Response) {
    try {
      await this.users.deleteRole(req.params.slug);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getPermissions(req: Request, res: Response) {
    try {
      res.json(await this.users.getPermissions());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async savePermission(req: Request, res: Response) {
    try {
      await this.users.savePermission(req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getUsers(req: Request, res: Response) {
    try {
      const docs = await this.users.getUsers();
      res.json({ docs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async saveUser(req: Request, res: Response) {
    try {
      const id = await this.users.saveUser(req.params.id ? parseInt(req.params.id) : null, req.body);
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
      const user = await this.users.getUser(id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
      await this.users.deleteUser(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async saveUserRoles(req: Request, res: Response) {
    try {
      const userId = parseInt(String(req.body?.userId || req.params?.id || ''), 10);
      if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });
      const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
      await this.users.saveUserRoles(userId, roles);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async checkUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.checkUpdate());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async applyUpdate(req: Request, res: Response) {
    try {
      res.json(await SystemUpdateService.applyUpdate());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getDataSources(req: Request, res: Response) {
    try {
      const docs = this.manager.getCollections().map((collection) => ({
        slug: collection.slug,
        shortSlug: collection.shortSlug || collection.slug,
        label: (collection as any).label || collection.slug,
        hidden: !!collection.admin?.hidden
      }));
      res.json({ docs, totalDocs: docs.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async queryDataSource(req: Request, res: Response) {
    try {
      const source = String(req.query.source || req.body?.source || req.query.slug || req.body?.slug || '').trim();
      if (!source) return res.status(400).json({ error: 'source is required' });

      const collection = this.manager.getCollections().find((c: any) => {
        return c.slug === source || c.shortSlug === source || c.unprefixedSlug === source;
      });
      if (!collection) return res.status(404).json({ error: `Unknown data source: ${source}` });

      const mergedQuery = { ...(req.query as any), ...(req.body || {}) } as any;
      delete mergedQuery.source;
      const data = await this.restController.find(collection, {
        query: mergedQuery,
        user: (req as any).user,
        locale: (req as any).locale,
        headers: req.headers,
        cookies: (req as any).cookies
      });
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getI18n(req: Request, res: Response) {
    const locale = (req.query.locale as string) || 'en';
    const activeSlugs = new Set(this.manager.getPlugins().filter(p => p.state === 'active').map(p => p.manifest.slug));
    const translations = (this.manager as any).i18n.translations.get(locale) || {};
    const filtered: any = {};
    for (const [slug, data] of Object.entries(translations)) {
      if (activeSlugs.has(slug)) filtered[slug] = data;
    }
    res.json(filtered);
  }

  async resolveSlug(req: Request, res: Response) {
    try {
      const slug = req.query.slug as string;
      if (!slug) return res.status(400).json({ error: 'Slug is required' });

      const isAdmin = (req as any).user?.roles?.includes('admin');
      const isPreview = req.query.preview === '1' || req.query.draft === '1';
      
      const result = await this.resolution.resolveSlug(slug, {
        user: (req as any).user,
        preview: isAdmin || isPreview,
        locale: req.query.locale as string,
        fallback_locale: req.query.fallback_locale as string,
        locale_mode: req.query.locale_mode as string
      });

      if (!result) return res.status(404).json({ error: 'Not found' });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getEvents(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    const handler = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    this.manager.hooks.on('system:hmr:reload', handler);
    const hb = setInterval(() => res.write(': heartbeat\n\n'), 15000);
    req.on('close', () => {
      clearInterval(hb);
      this.manager.hooks.off('system:hmr:reload', handler);
    });
  }
}
