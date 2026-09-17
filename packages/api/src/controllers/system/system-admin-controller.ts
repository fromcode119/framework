import { Request, Response } from 'express';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { ApplicationUrlUtils, AttentionResolutionService, CoreServices, HostResourceService, InstallationChecklistService, RecentEditsService, SystemConstants, TenantMode, PluginTenantAccess, AdminScope } from '@fromcode119/core';
import { SecretService } from '@fromcode119/core';
import { SystemSiteOverviewController } from '@api/controllers/system/system-site-overview-controller';

export class SystemAdminController {

  private readonly siteOverview: SystemSiteOverviewController;

  constructor(private readonly runtime: SystemControllerRuntime) {
    this.siteOverview = new SystemSiteOverviewController(runtime);
  }

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

      // `_system_scheduler_tasks` is a platform table with no row-level policy, so this listing showed
      // a site the scheduled work of every OTHER customer's plugins — task names like
      // a task named for a product that site does not run. Measured on a live box: a site running two
      // extensions was shown scheduled work belonging to two it does not. Same filter as the i18n
      // listing and
      // for the same reason; `total` counts what is shown, or the screen says 8 and lists 2.
      const boundTenantId = String((req as any).tenantId || '').trim();
      const ownTasks = TenantMode.isEnabled() && boundTenantId
        ? (tasks || []).filter((task: any) => {
          const slug = String(task?.plugin_slug ?? '').trim();
          return !slug || PluginTenantAccess.enabledSlugsFor(boundTenantId).has(slug);
        })
        : (tasks || []);

      res.json({
        total: TenantMode.isEnabled() && boundTenantId
          ? ownTasks.length
          : await this.runtime.db.count(SystemConstants.TABLE.SCHEDULER_TASKS),
        upcoming: ownTasks.map((task: any) => ({
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

  /** @see SystemSiteOverviewController.getSiteStats */
  getSiteStats(...args: Parameters<SystemSiteOverviewController["getSiteStats"]>): ReturnType<SystemSiteOverviewController["getSiteStats"]> {
    return this.siteOverview.getSiteStats(...args);
  }

  /** @see SystemSiteOverviewController.getRecentEdits */
  getRecentEdits(...args: Parameters<SystemSiteOverviewController["getRecentEdits"]>): ReturnType<SystemSiteOverviewController["getRecentEdits"]> {
    return this.siteOverview.getRecentEdits(...args);
  }

  /** @see SystemSiteOverviewController.getInstallation */
  getInstallation(...args: Parameters<SystemSiteOverviewController["getInstallation"]>): ReturnType<SystemSiteOverviewController["getInstallation"]> {
    return this.siteOverview.getInstallation(...args);
  }

  /**
   * The security summary, for the plugins THIS SCOPE runs.
   *
   * `getSecuritySummary()` reads every plugin loaded on the container. Behind `system:view` — which a
   * site's own administrator holds — that handed one customer the full registry of what every other
   * customer runs, each entry's isolation state and held reasons included.
   */
  async getSecurityStats(req: Request, res: Response) {
    try {
      const summary = await this.runtime.manager.getSecuritySummary();
      const tenantId = this.siteOverview.boundTenantId(req);
      if (!tenantId) return res.json(summary);
      res.json(this.siteOverview.securitySummaryForSite(summary, tenantId));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
