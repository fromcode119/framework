import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * The label above a group of rows.
 *
 * It used to be an indigo tick, a small-caps label, a hairline rule stretched across the page and a
 * right-aligned count — four devices to say one word. At dashboard scale the rules read as table
 * borders and the ticks as status lights, so the page looked like it was reporting something in
 * every gap between panels.
 *
 * A quiet label and the space above it are enough to separate two groups; the count, when there is
 * one, sits next to the word it counts rather than at the far end of a rule.
 */
export class DashboardSectionHeading extends PureReactor {
  @prop declare label: string;
  @prop declare count?: ReactNode;

  render(): ReactNode {
    return (
      <div className="flex items-baseline gap-2 px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
          {this.label}
        </h2>
        {this.count !== undefined && this.count !== null && this.count !== '' ? (
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold leading-[16px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {this.count}
          </span>
        ) : null}
      </div>
    );
  }
}
