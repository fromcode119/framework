import React from 'react';
import { Card } from '@/components/ui/card';
import { PluginTrendChart } from '@/components/plugin-dashboard/plugin-trend-chart';
import type { DashboardActivityChartProps } from './dashboard-activity-chart.interfaces';

/** Aggregates the recent activity log into per-day counts and renders a compact trend chart. */
export class DashboardActivityChart extends React.Component<DashboardActivityChartProps> {
  render(): React.ReactNode {
    const { activity, days = 14 } = this.props;

    const buckets: { key: string; label: string; total: number; errors: number }[] = [];
    const index: Record<string, number> = {};
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      index[key] = buckets.length;
      buckets.push({ key, label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }), total: 0, errors: 0 });
    }

    for (const item of activity || []) {
      if (!item?.timestamp) continue;
      const key = new Date(item.timestamp).toISOString().slice(0, 10);
      const i = index[key];
      if (i === undefined) continue;
      buckets[i].total += 1;
      if (String(item.level).toUpperCase() === 'ERROR') buckets[i].errors += 1;
    }

    const totalEvents = buckets.reduce((s, b) => s + b.total, 0);

    return (
      <Card title={`Platform Activity · last ${days} days`}>
        <PluginTrendChart
          height={140}
          xLabels={buckets.map((b) => b.label)}
          series={[
            { label: 'Events', data: buckets.map((b) => b.total), color: '#6366f1' },
            { label: 'Errors', data: buckets.map((b) => b.errors), color: '#f43f5e' },
          ]}
          formatValue={(v) => String(Math.round(v))}
        />
        <p className="mt-3 text-[11px] font-medium text-slate-400">{totalEvents} logged events in this window</p>
      </Card>
    );
  }
}
