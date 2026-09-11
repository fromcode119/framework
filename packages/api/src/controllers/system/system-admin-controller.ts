import { Request, Response } from 'express';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { AttentionResolutionService, CoreServices, HostResourceService, SystemConstants } from '@fromcode119/core';

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

  /**
   * What the machine is doing — memory, CPU load, disk, uptime. Measured, never configured: see
   * HostResourceService. Behind the same `system:view` permission as the other stats.
   */
  async getHostStats(req: Request, res: Response) {
    try {
      res.json(await HostResourceService.read());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** How many upcoming runs the dashboard shows before it becomes a list nobody reads. */
  private static readonly SCHEDULE_OUTLOOK_LIMIT = 8;

  /**
   * What the scheduler will do next, and what it last did — read from the scheduler's OWN table, so
   * the dashboard cannot claim a cadence that is not the one running. A task with no `next_run` has
   * never been pulsed; that is reported as null rather than guessed from its schedule.
   */
  async getScheduleOutlook(req: Request, res: Response) {
    try {
      const tasks = await this.runtime.db.find(SystemConstants.TABLE.SCHEDULER_TASKS, {
        orderBy: { next_run: 'asc' },
        limit: SystemAdminController.SCHEDULE_OUTLOOK_LIMIT,
      });
      res.json({
        total: await this.runtime.db.count(SystemConstants.TABLE.SCHEDULER_TASKS),
        upcoming: (tasks || []).map((task: any) => ({
          name: task.name,
          pluginSlug: task.plugin_slug || '',
          schedule: task.schedule,
          type: task.type,
          isActive: task.is_active !== false,
          nextRun: task.next_run ?? null,
          lastRun: task.last_run ?? null,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** How far back a failed webhook delivery still counts as something to act on. */
  private static readonly WEBHOOK_WINDOW_MS = 24 * 60 * 60 * 1000;

  /**
   * Everything that needs the operator: the framework's own platform checks plus whatever the
   * installed plugins report as unfinished. Core supplies the two reads that need a database; the
   * resolution service owns the ordering and the provider timeouts.
   */
  async getAttention(req: Request, res: Response) {
    try {
      const resolver = new AttentionResolutionService(CoreServices.getInstance().attention, {
        listPlugins: () => this.runtime.manager.getPlugins() as any[],
        // `ok`, not `success`: the column is a boolean named for the delivery's outcome, and the
        // wrong name is not a no-op — the query fails and the whole list 500s.
        countWebhookFailures: async (since: Date) => this.runtime.db.count(SystemConstants.TABLE.WEBHOOK_DELIVERIES, {
          where: { ok: false, created_at: { gte: since.toISOString() } },
        }),
      });
      const [items, webhookItem] = await Promise.all([resolver.list(), resolver.webhookFailureItem()]);
      const all = webhookItem ? [...items, webhookItem] : items;
      res.json({ items: all.map((item) => item.toJSON()) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Error-level log entries newer than this still count towards a site's health. */
  private static readonly SITE_HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;

  /**
   * One row per site: its host, the theme actually serving it, and whether anything has gone wrong
   * there today. Traffic, orders and revenue are NOT here — those belong to whichever plugin owns
   * them, and a site with no commerce must show nothing rather than a zero that claims it sold none.
   */
  async getSiteStats(req: Request, res: Response) {
    try {
      const tenants = await this.runtime.db.find(SystemConstants.TABLE.TENANTS, { limit: 100 });
      const themes = await this.runtime.db.find(SystemConstants.TABLE.TENANT_THEMES, { where: { state: 'active' }, limit: 200 });
      const themeByTenant = new Map<string, any>((themes || []).map((row: any) => [String(row.tenant_id), row]));
      const since = new Date(Date.now() - SystemAdminController.SITE_HEALTH_WINDOW_MS).toISOString();

      const sites = await Promise.all((tenants || []).map(async (tenant: any) => ({
        id: String(tenant.id),
        slug: String(tenant.slug || ''),
        host: String(tenant.primary_host || ''),
        state: String(tenant.state || ''),
        kind: String(tenant.kind || ''),
        themeSlug: String(themeByTenant.get(String(tenant.id))?.theme_slug || ''),
        errors24h: await this.countSiteErrors(String(tenant.id), since),
      })));

      res.json({ sites });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** A site with no tenant-scoped log rows simply has no errors; a failed count must not read as 0. */
  private async countSiteErrors(tenantId: string, since: string): Promise<number | null> {
    try {
      return await this.runtime.db.count(SystemConstants.TABLE.LOGS, {
        where: { level: 'ERROR', tenant_id: tenantId, created_at: { gte: since } },
      });
    } catch {
      return null;
    }
  }

  async getSecurityStats(req: Request, res: Response) {
    try {
      res.json(await this.runtime.manager.getSecuritySummary());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
