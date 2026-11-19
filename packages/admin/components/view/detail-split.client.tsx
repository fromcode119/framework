import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * A detail page's Overview body: what the thing is and does in the main column, its facts in a narrow
 * column beside it — each part a card of its own, as on a record's page. On a phone the narrow column
 * follows the main one.
 */
export class DetailSplit extends PureReactor {
  @prop declare main: ReactNode;
  @prop declare aside: ReactNode;
  /** Accepted for backward-compat and ignored — the look comes from the kit. */
  @prop declare theme?: ThemeMode;

  render(): ReactNode {
    return (
      <div className="fc-record-split fc-record-split--narrow">
        <div className="fc-columns__stack">{this.main}</div>
        <aside className="fc-columns__stack">{this.aside}</aside>
      </div>
    );
  }
}
