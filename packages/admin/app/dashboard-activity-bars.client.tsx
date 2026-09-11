import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/** Daily counts as bars, for windows too short to draw a line through. */
export class DashboardActivityBars extends PureReactor {
  @prop declare buckets: Array<{ key: string; label: string; total: number; errors: number }>;

  private get peak(): number {
    return Math.max(1, ...this.buckets.map((bucket) => bucket.total));
  }

  render(): ReactNode {
    const peak = this.peak;
    return (
      <div className="flex items-end gap-1.5 h-10">
        {this.buckets.map((bucket) => (
          <div
            key={bucket.key}
            title={`${bucket.label}: ${bucket.total} ${bucket.total === 1 ? 'event' : 'events'}`}
            className="flex-1 rounded-sm bg-indigo-500/90 dark:bg-indigo-500 min-h-[2px]"
            style={{ height: `${Math.round((bucket.total / peak) * 100)}%` }}
          />
        ))}
      </div>
    );
  }
}
