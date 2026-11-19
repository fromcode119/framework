import { RecordCard } from '@/components/ui/view/record-card.client';
import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmptyState } from '@/components/ui/view/empty-state.client';

/** Aggregates the recent activity log by source (plugin/system) into a compact share bar list. */
export class DashboardActivityBreakdown extends PureReactor {
  @prop declare activity: Array<{ plugin?: string; level?: string; timestamp?: string | number }>;

  render(): ReactNode {
    const activity = this.activity;

    const counts: Record<string, number> = {};
    for (const item of activity || []) {
      const key = item?.plugin && item.plugin !== 'system' ? (item.plugin.charAt(0).toUpperCase() + item.plugin.slice(1)) : AdminI18n.t('dashboard.system');
      counts[key] = (counts[key] || 0) + 1;
    }
    const rows = Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;

    return (
      <RecordCard title={AdminI18n.t('dashboard.activityBySource')}>
        {rows.length === 0 ? <EmptyState inline title={AdminI18n.t('dashboard.noActivityWindow')} /> : (
          <div className="fc-stack">
            {rows.map((r) => <ProgressBar key={r.label} label={r.label} detail={String(r.value)} value={Math.max(6, (r.value / max) * 100)} />)}
          </div>
        )}
      </RecordCard>
    );
  }
}
