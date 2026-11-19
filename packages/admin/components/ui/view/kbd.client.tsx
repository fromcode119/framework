import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A key, or a short sequence of keys, as it is printed wherever the console names one: beside a menu
 * row, in the search field, at the foot of the big search, on a dialog's way out. ONE look; a caller
 * may place it (`className`), never restyle it.
 */
export class Kbd extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare className?: string;

  render(): ReactNode {
    return <kbd className={`${AdminClass.of('kbd')} ${this.className ?? ''}`}>{this.children}</kbd>;
  }
}
