import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/** A heading in one of the console's three sizes. The level is also the element: h1, h2 or h3. */
export class Heading extends PureReactor {
  @prop declare children: ReactNode;
  @prop declare level?: 'h1' | 'h2' | 'h3';
  @prop declare className?: string;

  render(): ReactNode {
    const level = this.level ?? 'h1';
    const Tag = level;
    return <Tag className={`${AdminClass.of('heading')} ${AdminClass.of('heading')}--${level} ${this.className ?? ''}`}>{this.children}</Tag>;
  }
}
