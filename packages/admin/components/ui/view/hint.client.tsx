import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/** One line under a control: what it is for, or — as `error` — what is wrong with it, as `warning` what needs attention before it works, or — as `success` — what is already in place. */
export class Hint extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare variant?: 'info' | 'error' | 'warning' | 'success';
  @prop declare className?: string;

  render(): ReactNode {
    const name = AdminClass.of('hint');
    const error = this.variant === 'error';
    const success = this.variant === 'success';
    const warning = this.variant === 'warning';
    return (
      <span className={`${name}${error ? ` ${name}--error` : ''}${warning ? ` ${name}--warning` : ''}${success ? ` ${name}--success` : ''} ${this.className ?? ''}`} role={error ? 'alert' : undefined}>
        {error ? <FrameworkIcons.Alert size={14} /> : null}
        {warning ? <FrameworkIcons.Warning size={14} /> : null}
        {success ? <FrameworkIcons.CheckCircle size={14} /> : null}
        <span>{this.children}</span>
      </span>
    );
  }
}
