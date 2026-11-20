import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { AdminApi } from '@/lib/api';
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

  private static tone(state: string): string {
    if (state === 'failed') return 'danger';
    return state === 'active' ? 'info' : 'default';
  }

  private get columns(): Array<{ header: string; id: string; className?: string; accessor: (row: any) => ReactNode }> {
    return [
      { header: AdminI18n.t('jobs.queue.job'), id: 'job', accessor: (row) => <span className="fc-dt-inline"><span className="fc-dt-strong">{row.name}</span><span className="fc-dt-quiet">{row.queue}</span></span> },
      { header: AdminI18n.t('jobs.queue.state'), id: 'state', accessor: (row) => <StateBadge tone={JobsQueueTable.tone(row.state)}>{AdminI18n.optional(`jobs.queue.states.${row.state}`) || row.state}</StateBadge> },
      { header: AdminI18n.t('jobs.queue.runs'), id: 'runAt', accessor: (row) => (row.runAt ? RelativeTimeFormatter.fromNow(row.runAt) : AdminI18n.t('jobs.queue.whenFree')) },
      { header: AdminI18n.t('jobs.queue.attempts'), id: 'attempts', accessor: (row) => `${row.attemptsMade} / ${row.attempts}` },
      { header: AdminI18n.t('jobs.queue.error'), id: 'error', className: 'fc-dt-fill fc-dt-wrap', accessor: (row) => (row.failedReason ? <span className="fc-dt-lines" data-tone="danger">{row.failedReason}</span> : null) },
    ];
  }

  render(): ReactNode {
    return (
      <ListShell title={AdminI18n.t('jobs.queue.heading')} subtitle={AdminI18n.t('jobs.queue.subheading')}>
        <DataTable
          columns={this.columns as any}
          data={this.jobs}
          emptyMessage={this.loading ? AdminI18n.t('jobs.loading') : this.failed ? AdminI18n.t('jobs.queue.failed') : AdminI18n.t('jobs.queue.empty')}
        />
      </ListShell>
    );
  }
}
