import { PluginTenantAccess, SystemConstants, TenantMode, TenantResolverService } from '@fromcode119/core';

/**
 * What the background jobs are and what they did, as one site or the platform may see it.
 *
 * THE SCOPE DECIDES THE ROWS. A run is a journal row: written inside a site it is that site's, written
 * with no site bound it is the platform's (`TenantBespokePolicies`). So a site's administrator sees the
 * tasks of the extensions that site runs, and only what those tasks did for that site; the platform
 * scope sees every task — the platform's own included — and every pass, with each site's part under it.
 */
export class JobsOverviewService {
  private static readonly FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
  private static readonly RUNS_LIMIT = 100;

  constructor(private readonly db: any) {}

  /** Every task this scope may see, each with its last run and how many runs failed in the last day. */
  async tasks(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const all = await this.db.find(SystemConstants.TABLE.SCHEDULER_TASKS, { orderBy: { name: 'asc' }, limit: 500 });
    const visible = (all || []).filter((task: any) => this.visibleTo(tenantId, String(task?.plugin_slug ?? '').trim()));
    const since = new Date(Date.now() - JobsOverviewService.FAILURE_WINDOW_MS).toISOString();
    return Promise.all(visible.map(async (task: any) => {
      const own = this.ownRuns(tenantId, { task_name: task.name });
      const [last] = await this.db.find(SystemConstants.TABLE.SCHEDULER_RUNS, { where: own, orderBy: { started_at: 'desc' }, limit: 1 });
      const failedLastDay = await this.db.count(SystemConstants.TABLE.SCHEDULER_RUNS, { where: { ...own, status: 'failed', started_at: { gte: since } } });
      return {
        name: task.name,
        pluginSlug: task.plugin_slug || null,
        schedule: task.schedule,
        type: task.type,
        isActive: task.is_active !== false,
        nextRun: task.next_run ?? null,
        lastRun: last ? JobsOverviewService.run(last) : null,
        failedLastDay,
      };
    }));
  }

  /**
   * One task's recent runs, newest first. In the platform scope each pass carries the sites it ran
   * for, by name; inside a site the runs ARE that site's.
   */
  async runs(tenantId: string, taskName: string): Promise<Array<Record<string, unknown>>> {
    const task = await this.db.findOne(SystemConstants.TABLE.SCHEDULER_TASKS, { name: taskName });
    if (!task || !this.visibleTo(tenantId, String(task.plugin_slug ?? '').trim())) return [];
    const rows = await this.db.find(SystemConstants.TABLE.SCHEDULER_RUNS, {
      where: this.ownRuns(tenantId, { task_name: taskName }),
      orderBy: { started_at: 'desc' },
      limit: JobsOverviewService.RUNS_LIMIT,
    });
    const runs = (rows || []).map((row: any) => JobsOverviewService.run(row));
    if (tenantId || !runs.length) return runs;
    const children = await this.db.find(SystemConstants.TABLE.SCHEDULER_RUNS, {
      where: { parent_id: { in: runs.map((run: any) => run.id) } },
      orderBy: { started_at: 'asc' },
      limit: 5000,
    });
    const sites = await this.siteNames();
    return runs.map((run: any) => ({
      ...run,
      sites: (children || []).filter((child: any) => Number(child.parent_id) === run.id).map((child: any) => ({
        ...JobsOverviewService.run(child),
        site: sites.get(String(child.tenant_id ?? '')) ?? String(child.tenant_id ?? ''),
      })),
    }));
  }

  /** A site sees the tasks of the extensions it runs; the platform scope sees every task. */
  private visibleTo(tenantId: string, pluginSlug: string): boolean {
    if (!tenantId || !TenantMode.isEnabled()) return true;
    return Boolean(pluginSlug) && PluginTenantAccess.enabledSlugsFor(tenantId).has(pluginSlug);
  }

  /**
   * The rows of this scope. Inside a site, the policy already narrows to its own rows; in the platform
   * scope the passes are the rows with no parent, and the sites' parts are read with them.
   */
  private ownRuns(tenantId: string, where: Record<string, unknown>): Record<string, unknown> {
    return tenantId ? where : { ...where, parent_id: null };
  }

  private async siteNames(): Promise<Map<string, string>> {
    if (!TenantMode.isEnabled()) return new Map();
    const tenants = await TenantResolverService.shared(this.db).listActive();
    return new Map(tenants.map((tenant) => [tenant.id, tenant.primaryHost || tenant.slug]));
  }

  private static run(row: any): Record<string, unknown> {
    return {
      id: Number(row.id),
      status: row.status,
      startedAt: row.started_at ?? null,
      finishedAt: row.finished_at ?? null,
      durationMs: row.duration_ms ?? null,
      error: row.error ?? null,
    };
  }
}
