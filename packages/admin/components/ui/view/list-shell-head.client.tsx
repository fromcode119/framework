import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/** The head of a list's card: its name, how many it holds, one line that explains it, and its actions. */
export class ListShellHead extends PureReactor {
  @prop declare title: ReactNode;
  /** How many the list holds, beside the name: `0` is a figure and is shown, `null` is not. */
  @prop declare count?: number | null;
  @prop declare subtitle?: ReactNode;
  @prop declare actions?: ReactNode;

  render(): ReactNode {
    const card = AdminClass.of('record-card');
    return (
      <div className={`${card}__head`}>
        <h2 className={`${card}__title`}>
          {this.title}
          {this.count !== null && this.count !== undefined ? <span className={`${card}__count`}>{this.count}</span> : null}
        </h2>
        {this.subtitle ? <p className={`${card}__subtitle`}>{this.subtitle}</p> : null}
        {this.actions ? <div className={`${card}__aside`}>{this.actions}</div> : null}
      </div>
    );
  }
}
