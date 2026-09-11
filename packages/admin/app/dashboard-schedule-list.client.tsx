import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RelativeTimeFormatter } from '@/lib/relative-time-formatter';

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
    if (!total) {
      return (
        <div className="px-3 py-2">
          <p className="text-[11px] text-slate-500">No scheduled tasks registered.</p>
        </div>
      );
    }

    return (
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Next scheduled</span>
          <span className="text-[10px] text-slate-400">{total} tasks</span>
        </div>
        <div className="space-y-1">
          {this.upcoming.map((task) => (
            <div key={String(task.name)} className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {String(task.name)}
                {task.pluginSlug ? <span className="text-slate-400"> · {String(task.pluginSlug)}</span> : null}
              </span>
              <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                {task.isActive === false ? 'paused' : RelativeTimeFormatter.fromNow(task.nextRun)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
