import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { RelativeTimeFormatter } from '@/lib/relative-time-formatter';

/**
 * What waits in the queue now: jobs extensions asked to run later, tasks dispatched and not yet done,
 * and jobs that failed. Platform scope only — a queued job carries no site.
 */
export class JobsQueueTable extends AdminComponent {
  @state private jobs: any[] = [];
  @state private loading = true;
  @state private failed = false;

  componentDidMount(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.JOBS.QUEUE);
      this.jobs = (Array.isArray(response?.jobs) ? response.jobs : []).map((job: any) => ({ ...job, id: `${job.queue}:${job.id}` }));
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  private get columns(): Array<{ header: string; id: string; accessor: (row: any) => ReactNode }> {
    return [
      { header: AdminI18n.t('jobs.queue.job'), id: 'job', accessor: (row) => <div className="flex flex-col"><span className="text-[13px] font-semibold text-slate-700 dark:text-white">{row.name}</span><span className="text-[11px] text-slate-400">{row.queue}</span></div> },
      { header: AdminI18n.t('jobs.queue.state'), id: 'state', accessor: (row) => <Badge variant={row.state === 'failed' ? BadgeVariant.DANGER : row.state === 'active' ? BadgeVariant.INFO : BadgeVariant.GRAY}>{AdminI18n.optional(`jobs.queue.states.${row.state}`) || row.state}</Badge> },
      { header: AdminI18n.t('jobs.queue.runs'), id: 'runAt', accessor: (row) => <span className="text-[12px] text-slate-500 tabular-nums">{row.runAt ? RelativeTimeFormatter.fromNow(row.runAt) : AdminI18n.t('jobs.queue.whenFree')}</span> },
      { header: AdminI18n.t('jobs.queue.attempts'), id: 'attempts', accessor: (row) => <span className="text-[12px] text-slate-500 tabular-nums">{row.attemptsMade} / {row.attempts}</span> },
      { header: AdminI18n.t('jobs.queue.error'), id: 'error', accessor: (row) => <span className="text-[12px] text-rose-700 dark:text-rose-300 break-words">{row.failedReason || ''}</span> },
    ];
  }

  render(): ReactNode {
    return (
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{AdminI18n.t('jobs.queue.heading')}</h2>
          <p className="text-[12px] text-slate-500">{AdminI18n.t('jobs.queue.subheading')}</p>
        </div>
        <div className={`${AdminClass.SURFACE} overflow-hidden`}>
          <DataTable
            columns={this.columns}
            data={this.jobs}
            emptyMessage={this.loading ? AdminI18n.t('jobs.loading') : this.failed ? AdminI18n.t('jobs.queue.failed') : AdminI18n.t('jobs.queue.empty')}
          />
        </div>
      </section>
    );
  }
}
