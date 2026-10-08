import { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger } from '@fromcode119/core';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';
import { JobsOverviewService } from '@api/services/system/jobs-overview-service';

/**
 * HTTP for the Jobs page: the scheduled tasks, one task's runs, and the queue.
 *
 * Who sees what follows the Activity journal exactly: inside a site, that site's own; a platform admin
 * standing in the platform scope reads across every site, and only there (`readsWholeContainer`).
 */
export class JobsAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'jobs-admin' });
  private readonly overview: JobsOverviewService;

  constructor(private readonly manager: any) {
    super();
    this.overview = new JobsOverviewService(manager.db);
  }

  async tasks(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = JobsAdminController.tenantOf(req);
      res.json({ scope: tenantId ? 'site' : 'platform', tasks: await this.read(req, () => this.overview.tasks(tenantId)) });
    } catch (error) {
      this.logger.error('Reading the scheduled tasks failed', error);
      res.status(500).json({ error: 'jobs_unavailable' });
    }
  }

  async runs(req: Request, res: Response): Promise<void> {
    try {
      const task = CoercionUtils.toString(req.query.task);
      if (!task) {
        res.status(400).json({ error: 'task_required' });
        return;
      }
      res.json({ runs: await this.read(req, () => this.overview.runs(JobsAdminController.tenantOf(req), task)) });
    } catch (error) {
      this.logger.error('Reading the runs failed', error);
      res.status(500).json({ error: 'jobs_unavailable' });
    }
  }

  /** The queue holds jobs with no site on them, so it is the platform's to see (the router says so). */
  async queue(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ jobs: await this.manager.jobs.listJobs(50) });
    } catch (error) {
      this.logger.error('Reading the queue failed', error);
      res.status(500).json({ error: 'queue_unavailable' });
    }
  }

  /** Inside a site the policy narrows every read; a platform admin in the platform scope asks for all. */
  private async read<T>(req: Request, work: () => Promise<T>): Promise<T> {
    const whole = !JobsAdminController.tenantOf(req) && await new PlatformAccessResolver(this.manager.db).isPlatformAdmin(req);
    return whole ? this.manager.db.withPlatformAdmin(work) : work();
  }

  private static tenantOf(req: Request): string {
    return String((req as any).tenantId || '').trim();
  }
}
