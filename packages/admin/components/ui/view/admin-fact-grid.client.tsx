import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IAdminFact } from '@/components/ui/interfaces/admin-fact.interface';

/**
 * Values that were RECORDED rather than entered: shown on a recessed surface under a lock bar, each
 * as a small label above its value.
 *
 * This is the admin's one read-only treatment, and the whole signal is the contrast with an editable
 * field. Editable controls are white boxes you can click into; this is the inverse — grey, with no
 * input affordance anywhere in it and a bar that says so in words. Drop either half and the values
 * stop reading as recorded: rendering them as bordered boxes with labels, which is what the order's
 * customer-details panel did, makes them look like a form nobody filled in.
 *
 * The label sits ABOVE its value because a fixed left column has to be as wide as the longest label
 * on the record, and every short value then sits alone in whatever is left over.
 *
 * Nothing here invents a value: a fact with no value is the caller's to omit, and `note` is a short
 * line ABOUT the value (a zero weight, a stale reading), never a substitute for one.
 */
export class AdminFactGrid extends PureReactor {
  @prop declare facts: IAdminFact[];
  /** States who wrote these values. Without it the surface is just grey — say it, don't imply it. */
  @prop declare lockLabel: string;
  @prop declare className?: string;

  private renderFact(fact: IAdminFact): ReactNode {
    return (
      <div key={fact.key} className={`min-w-0 ${fact.wide ? 'col-span-full' : ''}`}>
        <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500">
          {fact.label}
        </div>
        <div className={`text-[13px] font-medium leading-snug ${fact.note ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {fact.value}
          {fact.note ? (
            <div className="mt-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-400">{fact.note}</div>
          ) : null}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 ${this.className ?? ''}`}>
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <FrameworkIcons.Lock size={12} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <p className="text-[10.5px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
            {this.lockLabel}
          </p>
        </div>
        <div className="px-3.5 py-3.5">
          {/* `minmax(0,1fr)`, never a bare `1fr`: a bare track is `min-width:auto`, so one long
              unbroken value — an address, a URL — widens its column and pushes the grid past the
              panel. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-7 gap-y-3.5">
            {this.facts.map((fact) => this.renderFact(fact))}
          </div>
        </div>
      </div>
    );
  }
}
