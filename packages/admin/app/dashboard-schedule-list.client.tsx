import { Text } from '@/components/ui/view/text.client';
import { Label } from '@/components/ui/view/label.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RelativeTimeFormatter } from '@/lib/relative-time-formatter';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the scheduler will run next, in the order it will run it.
 *
 * A task the scheduler has never pulsed carries no `next_run`; it says "not scheduled yet" rather
 * than borrowing a time from its cadence, because the cadence is what it WILL be, not what is set.
 */
export class DashboardScheduleList extends PureReactor {
  @prop declare schedule: Record<string, any> | null;

  private static readonly VISIBLE = 4;

  private get upcoming(): Array<Record<string, any>> {
    const upcoming = this.schedule?.upcoming;
    return Array.isArray(upcoming) ? upcoming.slice(0, DashboardScheduleList.VISIBLE) : [];
  }

  render(): ReactNode {
    if (!this.schedule) return null;

    const total = Number(this.schedule.total || 0);
    if (!total) return <Text size="small" muted as="p">{AdminI18n.t('dashboard.noSchedules')}</Text>;

    return (
      <div className="fc-field-stack">
        <Label optional={AdminI18n.t('dashboard.tasksCount', { count: total })}>{AdminI18n.t('dashboard.nextScheduled')}</Label>
        <AdminFactGrid facts={this.upcoming.map((task) => ({
          key: String(task.name),
          label: `${String(task.name)}${task.pluginSlug ? ` · ${String(task.pluginSlug)}` : ''}`,
          value: task.isActive === false ? AdminI18n.t('dashboard.paused') : RelativeTimeFormatter.fromNow(task.nextRun),
        })) as any} />
      </div>
    );
  }
}
