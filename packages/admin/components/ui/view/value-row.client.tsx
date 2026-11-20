import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * One fact of a record: its name on the left, its value on the right, and an optional small action at
 * the end (open, edit). The same row a saved record draws for every field, so a value a plugin shows
 * reads exactly like the console's own.
 */
export class ValueRow extends PureReactor {
  @prop declare label: ReactNode;
  @prop declare children?: ReactNode;
  /** A control at the end of the row; the row keeps a column for it. */
  @prop declare action?: ReactNode;
  /** Draws the value muted — for a value that says it is absent. */
  @prop declare empty?: boolean;

  render(): ReactNode {
    const card = AdminClass.of('record-card');
    return (
      <div className={`${card}__row${this.action ? ` ${card}__row--act` : ''}`}>
        <div className={`${card}__label`}>{this.label}</div>
        <div className={`${card}__value${this.empty ? ` ${card}__value--none` : ''}`}>{this.children}</div>
        {this.action ?? null}
      </div>
    );
  }
}
