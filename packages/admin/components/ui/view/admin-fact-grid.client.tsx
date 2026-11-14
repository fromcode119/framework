import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IAdminFact } from '@/components/ui/interfaces/admin-fact.interface';

/**
 * Values that were RECORDED rather than entered, as the label / value rows a saved record's card lists
 * its own fields in — the console's one way of reading a value, whoever wrote it. The look is
 * `admin.css` (`fc-sro`, shared with StructuredReadOnlyField).
 *
 * Where the values come from, when the caller says it (`lockLabel`: "Taken from the selected order"),
 * is one quiet line under them — not a locked banner over them, which made every recorded block read
 * as a warning.
 *
 * Nothing here invents a value: a fact with no value is the caller's to omit, and `note` is a short
 * line ABOUT the value (a zero weight, a stale reading), never a substitute for one.
 */
export class AdminFactGrid extends PureReactor {
  @prop declare facts: IAdminFact[];
  /** Where the values come from, in a few words; left out when the field's description already says it. */
  @prop declare lockLabel?: string;
  @prop declare className?: string;

  private renderFact(fact: IAdminFact): ReactNode {
    return (
      <div key={fact.key} className="fc-sro__row">
        <dt className="fc-sro__label">{fact.label}</dt>
        <dd className="fc-sro__value">
          {fact.value}
          {fact.note ? <span className="fc-sro__note">{fact.note}</span> : null}
        </dd>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div className={`fc-sro${this.className ? ` ${this.className}` : ''}`}>
        <dl className="fc-sro__rows">{this.facts.map((fact) => this.renderFact(fact))}</dl>
        {this.lockLabel ? <p className="fc-sro__source">{this.lockLabel}</p> : null}
      </div>
    );
  }
}
