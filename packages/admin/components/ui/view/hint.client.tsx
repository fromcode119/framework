import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/** One line under a control: what it is for, or — as `error` — what is wrong with it. */
export class Hint extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare variant?: 'info' | 'error';
  @prop declare className?: string;

  render(): ReactNode {
    const name = AdminClass.of('hint');
    const error = this.variant === 'error';
    return (
      <span className={`${name}${error ? ` ${name}--error` : ''} ${this.className ?? ''}`} role={error ? 'alert' : undefined}>
        {error ? <FrameworkIcons.Alert size={14} /> : null}
        <span>{this.children}</span>
      </span>
    );
  }
}
