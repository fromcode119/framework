import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/** The bar over a page's list: what narrows it at the start (`lead`, usually `Tabs`), the search and the page's action at the end. */
export class PageBar extends PureReactor {
  @prop declare lead?: ReactNode;
  @prop declare children?: ReactNode;

  render(): ReactNode {
    const name = AdminClass.of('page-bar');
    return (
      <div className={name}>
        <div className={`${name}__lead`}>{this.lead}</div>
        {this.children ? <div className={`${name}__tools`}>{this.children}</div> : null}
      </div>
    );
  }
}
