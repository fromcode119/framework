import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * How the console says there is nothing here — once, for every place that has to say it.
 *
 * It used to say it in a different voice each time: four components of its own and a dozen
 * hand-written blocks, with the icon at 28, 48, 56 and 64px, the title at 13, 14, 18 and 20px, two
 * dashed borders, a bouncing plug and a button painted indigo in the markup. Nothing there is a
 * product decision; it is the same sentence in the same card, so it is one component.
 *
 * The caller brings the words and, where there is something to do about it, the control — never the
 * measurements.
 *
 * It carries `data-empty-state`, which is a contract, not decoration: DashboardWidgetFrame reads it
 * to tell a widget that has nothing to say from one that is simply quiet, and hushes the first.
 */
export class EmptyState extends PureReactor {
  /** Optional mark above the words; it carries no meaning the title does not already say. */
  @prop declare icon?: ReactNode;
  @prop declare title: string;
  /** The line under the title: what to do about it, or why there is nothing. */
  @prop declare hint?: ReactNode;
  /** The way out of the empty state — a link or a button the caller owns. */
  @prop declare action?: ReactNode;
  /** Inside a card row or a table cell, where the page has already given its own room. */
  @prop declare inline?: boolean;

  render(): ReactNode {
    return (
      <div data-empty-state className={this.inline ? 'fc-empty fc-empty--inline' : 'fc-empty'}>
        {this.icon ? <span className="fc-empty__icon">{this.icon}</span> : null}
        <span className="fc-empty__text">
          <span className="fc-empty__title">{this.title}</span>
          {this.hint ? <span className="fc-empty__hint">{this.hint}</span> : null}
        </span>
        {this.action ? <span className="fc-empty__action">{this.action}</span> : null}
      </div>
    );
  }
}
