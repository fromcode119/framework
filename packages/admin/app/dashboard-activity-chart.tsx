import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { PluginTrendChart } from '@/components/plugin-dashboard/view/plugin-trend-chart.client';
import { DashboardActivityWindow } from '@/app/dashboard-activity-window';
import { DashboardActivityBars } from '@/app/dashboard-activity-bars.client';

/**
 * Platform activity, in whichever of three forms the data can honestly support.
 *
 * It used to draw a 14-day line chart unconditionally. On a fresh installation that is one event
 * against an empty axis — a vertical stroke that looks like a spike and means "we logged your
 * account being created". The window class decides; this renders.
 */
export class DashboardActivityChart extends PureReactor {
  @prop declare activity: Array<{ timestamp?: string | number; level?: string }>;
  @prop declare days?: number;

  /** Days shown in the bar form — a week reads unlabelled; a fortnight of bars does not. */
  private static readonly BAR_DAYS = 7;

  private get days_(): number {
    return this.days ?? 14;
  }

  private get window(): DashboardActivityWindow {
    return DashboardActivityWindow.build(this.activity, this.days_);
  }

  private errorSuffix(errors: number): ReactNode {
    if (!errors) return null;
    return <span className="text-rose-500 font-semibold"> · {errors} {errors === 1 ? 'error' : 'errors'}</span>;
  }

  render(): ReactNode {
    const window = this.window;

    if (window.isEmpty) {
      return (
        <Card title="Platform Activity">
          <p className="text-[12px] text-slate-500">Nothing has happened on this platform yet.</p>
        </Card>
      );
    }

    if (!window.hasShape) {
      return (
        <Card title={`Platform Activity${window.firstActiveLabel ? ` · since ${window.firstActiveLabel}` : ''}`}>
          <div className="flex items-baseline gap-2.5 mb-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{window.totalEvents}</span>
            <span className="text-[12px] text-slate-500">
              {window.totalEvents === 1 ? 'event' : 'events'}
              {this.errorSuffix(window.totalErrors)}
            </span>
          </div>
          {/* Bars, not a line: a handful of daily counts is a comparison, and a line through them
              would assert a trend that three days cannot support. */}
          <DashboardActivityBars buckets={window.recentBuckets(DashboardActivityChart.BAR_DAYS)} />
        </Card>
      );
    }

    return (
      <Card title={`Platform Activity · last ${this.days_} days`}>
        <PluginTrendChart
          height={140}
          xLabels={window.buckets.map((bucket) => bucket.label)}
          series={[
            { label: 'Events', data: window.buckets.map((bucket) => bucket.total), color: '#6366f1' },
            { label: 'Errors', data: window.buckets.map((bucket) => bucket.errors), color: '#f43f5e' },
          ]}
          formatValue={(value) => String(Math.round(value))}
        />
        <p className="mt-3 text-[11px] font-medium text-slate-400">
          {window.totalEvents} logged events in this window
        </p>
      </Card>
    );
  }
}
