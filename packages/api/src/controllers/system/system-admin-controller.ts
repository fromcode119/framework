import { Request, Response } from 'express';
import { SystemControllerRuntime } from '@api/controllers/system/system-controller-runtime';
import { HostResourceService, SystemConstants } from '@fromcode119/core';

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

  async getSecurityStats(req: Request, res: Response) {
    try {
      res.json(await this.runtime.manager.getSecuritySummary());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
