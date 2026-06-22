import React from 'react';
import { Card } from '@/components/ui/card';
import type { DashboardActivityBreakdownProps } from './dashboard-activity-breakdown.interfaces';

/** Aggregates the recent activity log by source (plugin/system) into a compact share bar list. */
export class DashboardActivityBreakdown extends React.Component<DashboardActivityBreakdownProps> {
  render(): React.ReactNode {
    const { activity } = this.props;

    const counts: Record<string, number> = {};
    for (const item of activity || []) {
      const key = item?.plugin ? (item.plugin.charAt(0).toUpperCase() + item.plugin.slice(1)) : 'System';
      counts[key] = (counts[key] || 0) + 1;
    }
    const rows = Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;

    return (
      <Card title="Activity by source">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No activity in this window.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">{r.label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(6, (r.value / max) * 100)}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-500">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }
}
