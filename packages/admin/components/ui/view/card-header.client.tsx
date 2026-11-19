import { AdminClass } from '@/lib/admin-class';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

export class CardHeader extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare description?: string;
  @prop declare badge?: ReactNode;

  render(): ReactNode {
    const desc = this.description || this.subtitle;

    return (
      <div className={`${AdminClass.of('card__head')} ${AdminClass.of('card__head--split')}`}>
        <div>
          <h3 className={AdminClass.of('card__title')}>{this.title}</h3>
          {desc ? <p className={AdminClass.of('card__desc')}>{desc}</p> : null}
        </div>
        {this.badge}
      </div>
    );
  }
}
