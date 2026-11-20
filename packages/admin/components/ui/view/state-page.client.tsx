import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { AdminClass } from '@/lib/admin-class';

/** A whole page that has nothing to show — not found, did not load, not yours to open — and the way out of it. */
export class StatePage extends PureReactor {
  @prop declare icon?: ReactNode;
  @prop declare title: string;
  @prop declare hint?: ReactNode;
  /** One or two buttons. */
  @prop declare actions?: ReactNode;

  render(): ReactNode {
    const name = AdminClass.of('state-page');
    return (
      <div className={name}>
        <EmptyState icon={this.icon} title={this.title} hint={this.hint}
          action={this.actions ? <div className={`${name}__actions`}>{this.actions}</div> : undefined} />
      </div>
    );
  }
}
