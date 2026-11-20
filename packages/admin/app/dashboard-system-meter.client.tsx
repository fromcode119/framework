import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ByteSizeFormatter } from '@/lib/byte-size-formatter';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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

  private get tone(): ProgressBar['tone'] {
    const fraction = this.fraction ?? 0;
    if (fraction >= DashboardSystemMeter.CRITICAL_AT) return 'danger';
    if (fraction >= DashboardSystemMeter.WARN_AT) return 'warning';
    return undefined;
  }

  private get readout(): string {
    if (this.caption) return this.caption;
    if (this.fraction === null) return 'unknown';
    return AdminI18n.t('dashboard.usedOfTotal', { used: ByteSizeFormatter.format(this.used), total: ByteSizeFormatter.format(this.total) });
  }

  render(): ReactNode {
    const fraction = this.fraction;
    const detail = `${this.readout}${fraction !== null ? ` · ${Math.round(fraction * 100)}%` : ''}`;
    // No bar when nothing was reported: an empty bar and a bar at zero read the same and only one is true.
    if (fraction === null) return <div className="fc-progress"><div className="fc-progress__line"><span>{this.label}</span><span>{detail}</span></div></div>;
    return <ProgressBar label={this.label} detail={detail} value={Math.round(fraction * 100)} tone={this.tone} />;
  }
}
