import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * How far something that takes a while has got: a download, an upload, an import. A figure when it is
 * known; without one the bar moves on its own to say only that it is going.
 */
export class ProgressBar extends PureReactor {
  /** 0–100. Left out (or null) when the length is not known. */
  @prop declare value?: number | null;
  /** What is going on, at the start of the line over the bar. */
  @prop declare label?: ReactNode;
  /** How far, in the caller's words, at the end of that line: "4.2 of 14 MB". */
  @prop declare detail?: ReactNode;
  /** Says the figure is high: `warning` when it is getting there, `danger` when it is there. */
  @prop declare tone?: 'warning' | 'danger';
  @prop declare className?: string;

  render(): ReactNode {
    const name = AdminClass.of('progress');
    const known = typeof this.value === 'number' && Number.isFinite(this.value);
    const percent = known ? Math.max(0, Math.min(100, this.value as number)) : 0;
    return (
      <div className={`${name} ${this.className ?? ''}`} data-tone={this.tone}>
        {this.label || this.detail ? (
          <div className={`${name}__line`}><span>{this.label}</span><span>{this.detail}</span></div>
        ) : null}
        <div className={`${name}__track`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={known ? Math.round(percent) : undefined}>
          <div className={`${name}__fill${known ? '' : ` ${name}__fill--unknown`}`} style={known ? { width: `${percent}%` } : undefined} />
        </div>
      </div>
    );
  }
}
