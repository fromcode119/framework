import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * Cards side by side: two or three equal columns that fall to one on a narrow screen, with the
 * console's own gap between them. A page lays its cards out with this instead of a grid of its own.
 */
export class Columns extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare count?: 2 | 3;
  /** Each column is as tall as its content, instead of all as tall as the tallest. */
  @prop declare top?: boolean;
  @prop declare className?: string;

  render(): ReactNode {
    return <div className={`${AdminClass.of('columns')} ${this.className ?? ''}`} data-count={this.count ?? 2} data-top={this.top ? 'true' : undefined}>{this.children}</div>;
  }
}
