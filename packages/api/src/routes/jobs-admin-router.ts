import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { JobsAdminController } from '@api/controllers/system/jobs-admin-controller';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/jobs` — the Jobs page. `system:view`, like Activity: a site's administrator sees what
 * runs for their site. The queue is platform-only, because its jobs carry no site.
 */
export class JobsAdminRouter extends BaseRouter {
  private readonly controller: JobsAdminController;

  constructor(manager: any, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard) {
    super();
    this.controller = new JobsAdminController(manager);
  }

  protected registerRoutes(): void {
    const view = this.auth.requirePermission('system:view');
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, view, this.controller.tasks);
    this.get(S.JOBS_RUNS, view, this.controller.runs);
    this.get(S.JOBS_QUEUE, view, this.platformAdmin.middleware(), this.controller.queue);
  }
}
