import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

export class CardHeader extends PureReactor {
  @prop declare title: string;
  @prop declare subtitle?: string;
  @prop declare description?: string;
  @prop declare badge?: ReactNode;

  render(): ReactNode {
    const desc = this.description || this.subtitle;

    return (
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{this.title}</h3>
          {desc ? <p className="mt-1 text-xs text-slate-500">{desc}</p> : null}
        </div>
        {this.badge}
      </div>
    );
  }
}
