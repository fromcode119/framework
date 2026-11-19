import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/** A list of things as one card of rows; with nothing in it, the card says so in one quiet line (`empty`). */
export class ListCard extends PureReactor {
  @prop declare children?: ReactNode;
  /** What is said when there are no rows. Given, it is shown INSTEAD of the rows. */
  @prop declare empty?: ReactNode;

  render(): ReactNode {
    const name = AdminClass.of('ext-list');
    if (this.empty) return <div className={`${name} ${AdminClass.of('ext-empty')}`}>{this.empty}</div>;
    return <div className={name}>{this.children}</div>;
  }
}
