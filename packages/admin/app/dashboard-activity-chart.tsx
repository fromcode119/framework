import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminScope } from '@fromcode119/core/client';
import { Card } from '@/components/ui/view/card.client';
import { PluginTrendChart } from '@/components/plugin-dashboard/view/plugin-trend-chart.client';
import { DashboardActivityWindow } from '@/app/dashboard-activity-window';
import { DashboardActivityBars } from '@/app/dashboard-activity-bars.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Activity for the scope the console is in, in whichever of three forms the data can honestly
 * support. The journal behind it is tenant-scoped, so inside a site this is that site's activity;
 * the heading says which (see `scope`).
 *
 * It used to draw a 14-day line chart unconditionally. On a fresh installation that is one event
 * against an empty axis — a vertical stroke that looks like a spike and means "we logged your
 * account being created". The window class decides; this renders.
 */
export class DashboardActivityChart extends PureReactor {
  @prop declare activity: Array<{ timestamp?: string | number; level?: string }>;
  @prop declare days?: number;
  /**
   * Which scope the journal was read in, as `/admin/stats/installation` reports it — an
   * {@link AdminScope} value, arriving over JSON as its plain string. The feed is tenant-scoped, so inside a site these
   * events are that SITE's; heading them "Platform Activity" named a source the card is not
   * reading. Absent, the wording stays neutral rather than asserting either.
   */
  @prop declare scope?: string;

  /** Resolved ONCE: `scope` arrives as a JSON string, and a string never equals an enum member. */
  private get scope_(): AdminScope | undefined {
    return AdminScope.resolve(this.scope);
  }

  private get subject(): string {
    const scope = this.scope_;
    if (!scope) return AdminI18n.t('dashboard.recent');
    return AdminI18n.t(scope.isSite ? 'shell.site.site' : 'shell.site.platform');
  }

  private get emptyCopy(): string {
    const scope = this.scope_;
    if (!scope) return AdminI18n.t('dashboard.nothingYet');
    return scope.isSite
      ? AdminI18n.t('dashboard.nothingSite')
      : AdminI18n.t('dashboard.nothingPlatform');
  }

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
    return <span className="text-rose-500 font-semibold"> · {errors === 1 ? AdminI18n.t('dashboard.errorOne') : AdminI18n.t('dashboard.errorMany', { count: errors })}</span>;
  }

  render(): ReactNode {
    const window = this.window;

    if (window.isEmpty) {
      return (
        <Card title={AdminI18n.t('dashboard.activityTitle', { subject: this.subject })}>
          <p className="text-[12px] text-slate-500">{this.emptyCopy}</p>
        </Card>
      );
    }

    if (!window.hasShape) {
      return (
        <Card title={window.firstActiveLabel ? AdminI18n.t('dashboard.activitySince', { subject: this.subject, since: window.firstActiveLabel }) : AdminI18n.t('dashboard.activityTitle', { subject: this.subject })}>
          <div className="flex items-baseline gap-2.5 mb-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{window.totalEvents}</span>
            <span className="text-[12px] text-slate-500">
              {window.totalEvents === 1 ? AdminI18n.t('dashboard.eventWord') : AdminI18n.t('dashboard.eventsWord')}
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
      <Card title={AdminI18n.t('dashboard.activityDays', { subject: this.subject, days: this.days_ })}>
        <PluginTrendChart
          height={140}
          xLabels={window.buckets.map((bucket) => bucket.label)}
          series={[
            { label: AdminI18n.t('dashboard.events'), data: window.buckets.map((bucket) => bucket.total), color: '#6366f1' },
            { label: AdminI18n.t('dashboard.errors'), data: window.buckets.map((bucket) => bucket.errors), color: '#f43f5e' },
          ]}
          formatValue={(value) => String(Math.round(value))}
        />
        <p className="mt-3 text-[11px] font-medium text-slate-400">
          {AdminI18n.t('dashboard.loggedEventsInWindow', { count: window.totalEvents })}
        </p>
      </Card>
    );
  }
}
