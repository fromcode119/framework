import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Daily counts as bars, for windows too short to draw a line through. */
export class DashboardActivityBars extends PureReactor {
  @prop declare buckets: Array<{ key: string; label: string; total: number; errors: number }>;

  private get peak(): number {
    return Math.max(1, ...this.buckets.map((bucket) => bucket.total));
  }

  render(): ReactNode {
    const peak = this.peak;
    return (
      <div className="fc-bars">
        {this.buckets.map((bucket) => (
          <div
            key={bucket.key}
            title={`${bucket.label}: ${bucket.total} ${bucket.total === 1 ? AdminI18n.t('dashboard.eventWord') : AdminI18n.t('dashboard.eventsWord')}`}
            className="fc-bars__bar"
            style={{ height: `${Math.round((bucket.total / peak) * 100)}%` }}
          />
        ))}
      </div>
    );
  }
}
