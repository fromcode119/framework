import type { ReactNode } from 'react';
import { prop, state, watch } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { JobRunStatusBadge } from '@/app/jobs/job-run-status-badge';
import { JobDuration } from '@/app/jobs/job-duration';

/**
 * One task's recent runs, newest first: when, how long, how it ended and the error it ended with. In
 * the platform scope a pass lists the sites it ran for, each with its own result.
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

  render(): ReactNode {
    if (this.loading) return <p className="px-6 py-4 text-[12px] text-slate-400">{AdminI18n.t('jobs.loadingRuns')}</p>;
    if (this.failed) return <p className="px-6 py-4 text-[12px] text-rose-600">{AdminI18n.t('jobs.runsFailed')}</p>;
    if (!this.runs.length) return <p className="px-6 py-4 text-[12px] text-slate-400">{AdminI18n.t('jobs.noRuns')}</p>;
    return (
      <div className="px-6 py-4 space-y-2">
        <p className="text-[11px] font-semibold text-slate-500 tracking-wide">{AdminI18n.t('jobs.recentRuns', { count: this.runs.length })}</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {this.runs.map((run) => <li key={run.id} className="py-2">{this.renderRun(run)}</li>)}
        </ul>
      </div>
    );
  }

  private renderRun(run: any): ReactNode {
    const sites: any[] = Array.isArray(run.sites) ? run.sites : [];
    const failedSites = sites.filter((site) => site.status === 'failed');
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <JobRunStatusBadge status={String(run.status)} />
          <span className="text-[12px] text-slate-600 dark:text-slate-300 tabular-nums">{run.startedAt ? new Date(run.startedAt).toLocaleString(AdminI18n.locale) : ''}</span>
          <span className="text-[11px] text-slate-400 tabular-nums">{JobDuration.text(run.durationMs)}</span>
          {sites.length ? <span className="text-[11px] text-slate-500">{AdminI18n.t('jobs.sitesRan', { count: sites.length, failed: failedSites.length })}</span> : null}
        </div>
        {run.error ? <p className="text-[12px] text-rose-700 dark:text-rose-300 break-words">{run.error}</p> : null}
        {failedSites.map((site) => (
          <p key={site.id} className="text-[12px] text-rose-700 dark:text-rose-300 break-words">
            <span className="font-semibold">{site.site}</span>: {site.error}
          </p>
        ))}
      </div>
    );
  }
}
