import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPluginLogEntry } from '@/app/plugins/[slug]/interfaces/plugin-log-entry.interface';
import { DetailBox } from '@/components/view/detail-box.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The plugin's recent log lines across every site — the platform's view, so only in Platform scope. */
export class PluginOverviewActivity extends PureReactor {
  @prop declare loading: boolean;
  @prop declare logs: IPluginLogEntry[];
  @prop declare onRefresh: () => void;
  @prop declare theme: ThemeMode;

  private static tone(level: string): string {
    if (level === 'ERROR') return 'danger';
    return level === 'WARN' ? 'warning' : 'success';
  }

  render(): ReactNode {
    return (
      <ListShell title={AdminI18n.t('plugins.detail.recentActivity')}
        actions={<Button variant={ButtonVariant.GHOST} isLoading={this.loading} icon={<FrameworkIcons.Refresh size={15} />} onClick={this.onRefresh}>{AdminI18n.t('plugins.detail.refresh')}</Button>}>
        {this.logs.length ? (
          <DataTable
            // Three short columns, the middle one wrapping: it stays a table in the narrow column and on a phone.
            cards={false}
            columns={[
              { header: AdminI18n.t('activity.event'), id: 'level', accessor: (log: any) => <StateBadge tone={PluginOverviewActivity.tone(log.level)}>{AdminI18n.optional(`activity.level.${String(log.level || '').toUpperCase()}`) || log.level}</StateBadge> },
              { header: AdminI18n.t('activity.activity'), id: 'message', className: 'fc-dt-fill fc-dt-wrap', accessor: (log: any) => log.message },
              { header: AdminI18n.t('activity.time'), id: 'time', accessor: (log: any) => new Date(log.timestamp).toLocaleTimeString(AdminI18n.locale) },
            ] as any}
            data={this.logs.map((log, index) => ({ ...log, id: log.id || `${log.timestamp}-${index}` }))}
          />
        ) : (
          <EmptyState title={this.loading ? AdminI18n.t('plugins.detail.analyzingStream') : AdminI18n.t('plugins.detail.idleNoRecentEventsRecorded')} />
        )}
      </ListShell>
    );
  }
}
