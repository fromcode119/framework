import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * The words that name a control, for a control that does not carry a `label` of its own. `htmlFor`
 * ties it to the control, so pressing the words focuses it.
 */
export class Label extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare htmlFor?: string;
  /** A quiet "Optional" after the words. */
  @prop declare optional?: ReactNode;
  @prop declare className?: string;

  render(): ReactNode {
    const name = AdminClass.of('label');
    return (
      <label htmlFor={this.htmlFor} className={`${name} ${this.className ?? ''}`}>
        {this.children}
        {this.optional ? <span className={`${name}__optional`}>{this.optional}</span> : null}
      </label>
    );
  }
}
