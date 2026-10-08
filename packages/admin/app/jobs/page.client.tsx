import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { JobsTaskColumns } from '@/app/jobs/jobs-task-columns';
import { JobRunsPanel } from '@/app/jobs/job-runs-panel.client';
import { JobsQueueTable } from '@/app/jobs/jobs-queue-table.client';

/**
 * Jobs — what the platform and its extensions do on their own.
 *
 * Every scheduled task, whose it is, how often it runs, how its last run went and when it runs next;
 * opening one shows its recent runs and their errors. Inside a site: that site's extensions and what
 * they did for it. In the platform scope: every task, each site's part of every pass, and the queue.
 * Before this, none of it was anywhere an operator looks — a failing task reached only the server log.
 */
export class JobsPage extends AdminComponent {
  @state private tasks: any[] = [];
  /** Whether this is the platform scope (every task, each site's part, the queue) rather than one site's. */
  @state private platformScope = false;
  @state private loading = true;
  @state private failed = false;
  @state private openTask: string | null = null;

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

  @bound private toggle(row: any): void {
    this.openTask = this.openTask === row.name ? null : row.name;
  }

  @bound private renderRuns(row: any): ReactNode {
    return <JobRunsPanel taskName={row.name} />;
  }

  private get emptyMessage(): string {
    if (this.loading) return AdminI18n.t('jobs.loading');
    return this.failed ? AdminI18n.t('jobs.failed') : AdminI18n.t('jobs.empty');
  }

  render(): ReactNode {
    return (
      <div className="w-full pb-24">
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Clock size={18} strokeWidth={2.5} />}
          title={AdminI18n.t('jobs.title')}
          subtitle={this.platformScope ? AdminI18n.t('jobs.subtitlePlatform') : AdminI18n.t('jobs.subtitleSite')}
        />
        <div className="w-full px-6 lg:px-12 pt-8 space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{AdminI18n.t('jobs.scheduledHeading')}</h2>
              <p className="text-[12px] text-slate-500">{AdminI18n.t('jobs.scheduledHint')}</p>
            </div>
            <div className={`${AdminClass.SURFACE} overflow-hidden`}>
              <DataTable
                columns={JobsTaskColumns.all()}
                data={this.tasks}
                onRowClick={this.toggle}
                expandedRowId={this.openTask}
                renderExpandedRow={this.renderRuns}
                emptyMessage={this.emptyMessage}
              />
            </div>
          </section>
          {this.platformScope ? <JobsQueueTable /> : null}
        </div>
      </div>
    );
  }
}
