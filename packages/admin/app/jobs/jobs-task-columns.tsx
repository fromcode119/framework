import type { ReactNode } from 'react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { RelativeTimeFormatter } from '@/lib/relative-time-formatter';
import { JobScheduleText } from '@/app/jobs/job-schedule-text';
import { JobRunStatusBadge } from '@/app/jobs/job-run-status-badge';
import { JobDuration } from '@/app/jobs/job-duration';

/** The scheduled tasks as table columns: what, whose, how often, how it last went, and when next. */
export class JobsTaskColumns {
  static all(): Array<{ header: string; id: string; accessor: (row: any) => ReactNode }> {
    return [
      { header: AdminI18n.t('jobs.columns.task'), id: 'task', accessor: (row) => JobsTaskColumns.task(row) },
      { header: AdminI18n.t('jobs.columns.schedule'), id: 'schedule', accessor: (row) => <span className="text-[12px] text-slate-600 dark:text-slate-300">{row.isActive ? JobScheduleText.describe(row.schedule) : AdminI18n.t('jobs.paused')}</span> },
      { header: AdminI18n.t('jobs.columns.lastRun'), id: 'lastRun', accessor: (row) => JobsTaskColumns.lastRun(row) },
      { header: AdminI18n.t('jobs.columns.nextRun'), id: 'nextRun', accessor: (row) => <span className="text-[12px] text-slate-500 tabular-nums">{row.isActive ? RelativeTimeFormatter.fromNow(row.nextRun) : '—'}</span> },
    ];
  }

  private static task(row: any): ReactNode {
    const name = String(row.name || '');
    const short = row.pluginSlug && name.startsWith(`${row.pluginSlug}:`) ? name.slice(row.pluginSlug.length + 1) : name;
    return (
      <div className="flex flex-col">
        <span className="text-[13px] font-semibold text-slate-700 dark:text-white">{short}</span>
        <span className="text-[11px] text-slate-400">{row.pluginSlug ? AdminI18n.t('jobs.ownedBy', { owner: row.pluginSlug }) : AdminI18n.t('jobs.platform')}</span>
      </div>
    );
  }

  private static lastRun(row: any): ReactNode {
    const last = row.lastRun;
    if (!last) return <span className="text-[12px] text-slate-400">{AdminI18n.t('jobs.notRunYet')}</span>;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <JobRunStatusBadge status={String(last.status)} />
        <span className="text-[12px] text-slate-500 tabular-nums">{RelativeTimeFormatter.fromNow(last.startedAt)}</span>
        {last.durationMs !== null ? <span className="text-[11px] text-slate-400 tabular-nums">{JobDuration.text(last.durationMs)}</span> : null}
        {row.failedLastDay > 0 ? <span className="text-[11px] font-semibold text-rose-600">{AdminI18n.t('jobs.failedLastDay', { count: row.failedLastDay })}</span> : null}
      </div>
    );
  }
}
