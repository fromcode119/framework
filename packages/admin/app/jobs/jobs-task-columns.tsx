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
      { header: AdminI18n.t('jobs.columns.task'), id: 'task', accessor: (row) => <span className="fc-dt-strong">{JobsTaskColumns.short(row)}</span> },
      { header: AdminI18n.t('activity.plugin'), id: 'owner', accessor: (row) => row.pluginSlug || AdminI18n.t('jobs.platform') },
      { header: AdminI18n.t('jobs.columns.schedule'), id: 'schedule', accessor: (row) => (row.isActive ? JobScheduleText.describe(row.schedule) : AdminI18n.t('jobs.paused')) },
      { header: AdminI18n.t('jobs.columns.lastRun'), id: 'lastRun', accessor: (row) => JobsTaskColumns.lastRun(row) },
      { header: AdminI18n.t('jobs.columns.nextRun'), id: 'nextRun', accessor: (row) => (row.isActive ? RelativeTimeFormatter.fromNow(row.nextRun) : '—') },
    ];
  }

  /** The task's name without its owner in front: the owner stands in the column beside it. */
  private static short(row: any): string {
    const name = String(row.name || '');
    return row.pluginSlug && name.startsWith(`${row.pluginSlug}:`) ? name.slice(row.pluginSlug.length + 1) : name;
  }

  private static lastRun(row: any): ReactNode {
    const last = row.lastRun;
    if (!last) return <span className="fc-dt-quiet">{AdminI18n.t('jobs.notRunYet')}</span>;
    return (
      <span className="fc-dt-inline">
        <JobRunStatusBadge status={String(last.status)} />
        <span>{RelativeTimeFormatter.fromNow(last.startedAt)}</span>
        {last.durationMs !== null ? <span className="fc-dt-quiet">{JobDuration.text(last.durationMs)}</span> : null}
        {row.failedLastDay > 0 ? <span className="fc-dt-lines" data-tone="danger">{AdminI18n.t('jobs.failedLastDay', { count: row.failedLastDay })}</span> : null}
      </span>
    );
  }
}
