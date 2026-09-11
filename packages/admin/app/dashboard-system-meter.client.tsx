import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ByteSizeFormatter } from '@/lib/byte-size-formatter';

/**
 * One measured resource as a labelled bar.
 *
 * Takes EITHER a used/total pair (memory, disk) or a ready ratio (CPU pressure). An absent figure
 * renders the word "unknown" and no bar at all: an empty bar reads as "nothing used", which is the
 * opposite of what a failed measurement means.
 */
export class DashboardSystemMeter extends PureReactor {
  @prop declare label: string;
  @prop declare used?: number | null;
  @prop declare total?: number | null;
  @prop declare ratio?: number | null;
  @prop declare caption?: string;

  /** Amber from 75%, rose from 90% — the points at which an operator still has time to act. */
  private static readonly WARN_AT = 0.75;
  private static readonly CRITICAL_AT = 0.9;

  private get fraction(): number | null {
    if (this.ratio !== undefined && this.ratio !== null) return Math.max(0, Math.min(this.ratio, 1));
    const total = Number(this.total || 0);
    if (!total) return null;
    return Math.max(0, Math.min(Number(this.used || 0) / total, 1));
  }

  private get barClass(): string {
    const fraction = this.fraction ?? 0;
    if (fraction >= DashboardSystemMeter.CRITICAL_AT) return 'bg-rose-500';
    if (fraction >= DashboardSystemMeter.WARN_AT) return 'bg-amber-500';
    return 'bg-indigo-500';
  }

  private get readout(): string {
    if (this.caption) return this.caption;
    if (this.fraction === null) return 'unknown';
    return `${ByteSizeFormatter.format(this.used)} of ${ByteSizeFormatter.format(this.total)}`;
  }

  render(): ReactNode {
    const fraction = this.fraction;
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{this.label}</span>
          <span className="text-[10px] text-slate-400 tabular-nums">
            {this.readout}
            {fraction !== null ? ` · ${Math.round(fraction * 100)}%` : ''}
          </span>
        </div>
        {fraction !== null ? (
          <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-800">
            <div className={`h-1 rounded-full ${this.barClass}`} style={{ width: `${Math.round(fraction * 100)}%` }} />
          </div>
        ) : null}
      </div>
    );
  }
}
