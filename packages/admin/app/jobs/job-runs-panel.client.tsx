import type { ReactNode } from 'react';
import { prop, state, watch } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Alert } from '@/components/ui/view/alert.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { JobRunStatusBadge } from '@/app/jobs/job-run-status-badge';
import { JobDuration } from '@/app/jobs/job-duration';

/**
 * One task's recent runs, newest first, as the console's list: how each ended, when it started, how
 * long it took and the error it ended with. In the platform scope a pass also says how many sites it
 * ran for, and its error column names each site that failed with that site's own error.
 */
export class JobRunsPanel extends AdminComponent {
  @prop declare taskName: string;

  @state private runs: any[] = [];
  @state private loading = true;
  @state private failed = false;

  componentDidMount(): void {
    void this.load();
  }

  @watch('taskName')
  private onTaskChanged(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.failed = false;
    try {
      const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.JOBS.RUNS}?task=${encodeURIComponent(this.taskName)}`);
      this.runs = Array.isArray(response?.runs) ? response.runs : [];
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  private static sites(run: any): any[] {
    return Array.isArray(run.sites) ? run.sites : [];
  }

  /** The run's own error, then one line for each site it failed on. */
  private static errors(run: any): ReactNode {
    const failedSites = JobRunsPanel.sites(run).filter((site) => site.status === 'failed');
    if (!run.error && !failedSites.length) return null;
    return (
      <div className="fc-dt-lines" data-tone="danger">
        {run.error ? <span>{run.error}</span> : null}
        {failedSites.map((site) => <span key={site.id}><strong>{site.site}</strong>: {site.error}</span>)}
      </div>
    );
  }

  private get columns(): Array<{ header: string; id: string; className?: string; accessor: (row: any) => ReactNode }> {
    const columns: Array<{ header: string; id: string; className?: string; accessor: (row: any) => ReactNode }> = [
      { header: AdminI18n.t('jobs.queue.state'), id: 'state', accessor: (run) => <JobRunStatusBadge status={String(run.status)} /> },
      { header: AdminI18n.t('activity.time'), id: 'started', accessor: (run) => (run.startedAt ? new Date(run.startedAt).toLocaleString(AdminI18n.locale, { dateStyle: 'medium', timeStyle: 'medium' }) : '') },
      { header: AdminI18n.t('jobs.columns.duration'), id: 'duration', accessor: (run) => JobDuration.text(run.durationMs) },
    ];
    // Only a pass over several sites has a figure to give; a site's own task has no such column.
    if (this.runs.some((run) => JobRunsPanel.sites(run).length)) {
      columns.push({
        header: AdminI18n.t('sites.sites'),
        id: 'sites',
        accessor: (run) => {
          const sites = JobRunsPanel.sites(run);
          return sites.length ? AdminI18n.t('jobs.sitesRan', { count: sites.length, failed: sites.filter((site) => site.status === 'failed').length }) : '';
        },
      });
    }
    columns.push({ header: AdminI18n.t('jobs.queue.error'), id: 'error', className: 'fc-dt-fill fc-dt-wrap', accessor: (run) => JobRunsPanel.errors(run) });
    return columns;
  }

  render(): ReactNode {
    if (this.failed) return <Alert tone="danger">{AdminI18n.t('jobs.runsFailed')}</Alert>;
    return (
      <ListShell title={AdminI18n.t('jobs.queue.runs')} count={this.loading ? null : this.runs.length}>
        <DataTable
          columns={this.columns as any}
          data={this.runs}
          emptyMessage={this.loading ? AdminI18n.t('jobs.loadingRuns') : AdminI18n.t('jobs.noRuns')}
        />
      </ListShell>
    );
  }
}
