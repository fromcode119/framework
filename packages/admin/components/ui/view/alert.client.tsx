import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/**
 * A note at the head of a page or a card: something the operator should know before reading on, with
 * at most one thing to do about it. The box is quiet and the ICON carries the tone, so a page with a
 * note on it is still a page, not a coloured band.
 */
export class Alert extends PureReactor {
  @prop declare tone?: 'warning' | 'danger' | 'success' | 'info';
  /** A few words in full ink before the sentence. */
  @prop declare title?: ReactNode;
  @prop declare children?: ReactNode;
  @prop declare action?: ReactNode;
  /** Said aloud at once (`alert`) or when the reader gets to it (`status`). By default the tone decides. */
  @prop declare role?: 'alert' | 'status';
  @prop declare className?: string;

  private static readonly ROLE: Record<string, string> = { warning: 'alert', danger: 'alert', success: 'status', info: 'status' };

  render(): ReactNode {
    const name = AdminClass.of('alert');
    const tone = this.tone || 'info';
    return (
      <div className={`${name} ${this.className ?? ''}`} data-tone={tone} role={this.role ?? Alert.ROLE[tone]}>
        <span className={`${name}__icon`} aria-hidden="true">
          {tone === 'success' ? <FrameworkIcons.Check size={15} /> : tone === 'info' ? <FrameworkIcons.Info size={15} /> : <FrameworkIcons.Alert size={15} />}
        </span>
        <p className={`${name}__text`}>
          {this.title ? <strong className={`${name}__title`}>{this.title}</strong> : null}
          {this.children}
        </p>
        {this.action ? <div className={`${name}__action`}>{this.action}</div> : null}
      </div>
    );
  }
}
