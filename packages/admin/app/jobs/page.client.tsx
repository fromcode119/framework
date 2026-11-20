import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { JobsTaskColumns } from '@/app/jobs/jobs-task-columns';
import { JobsQueueTable } from '@/app/jobs/jobs-queue-table.client';

/**
 * Jobs — what the platform and its extensions do on their own.
 *
 * Every scheduled task, whose it is, how often it runs, how its last run went and when it runs next;
 * a task's row opens its own page, with its recent runs and their errors. Inside a site: that site's extensions and what
 * they did for it. In the platform scope: every task, each site's part of every pass, and the queue.
 * Before this, none of it was anywhere an operator looks — a failing task reached only the server log.
 */
export class JobsPage extends AdminComponent {
  @state private tasks: any[] = [];
  /** Whether this is the platform scope (every task, each site's part, the queue) rather than one site's. */
  @state private platformScope = false;
  @state private loading = true;
  @state private failed = false;

  componentDidMount(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.JOBS.TASKS);
      this.platformScope = response?.scope === 'platform';
      this.tasks = (Array.isArray(response?.tasks) ? response.tasks : []).map((task: any) => ({ ...task, id: task.name }));
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  /** A task opens its own page — this list's address, then the task — where its runs are. */
  @bound private open(row: any): void {
    this.router.push(`${String(this.pathname || '').replace(/\/$/, '')}/${encodeURIComponent(row.name)}`);
  }

  private get emptyMessage(): string {
    if (this.loading) return AdminI18n.t('jobs.loading');
    return this.failed ? AdminI18n.t('jobs.failed') : AdminI18n.t('jobs.empty');
  }

  render(): ReactNode {
    return (
      <div className={`w-full ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Clock size={18} strokeWidth={2.5} />}
          title={AdminI18n.t('jobs.title')}
          subtitle={this.platformScope ? AdminI18n.t('jobs.subtitlePlatform') : AdminI18n.t('jobs.subtitleSite')}
        />
        <div className="w-full py-6 fc-page-stack">
          <ListShell title={AdminI18n.t('jobs.scheduledHeading')} subtitle={AdminI18n.t('jobs.scheduledHint')}>
            <DataTable columns={JobsTaskColumns.all()} data={this.tasks} onRowClick={this.open} emptyMessage={this.emptyMessage} />
          </ListShell>
          {this.platformScope ? <JobsQueueTable /> : null}
        </div>
      </div>
    );
  }
}
