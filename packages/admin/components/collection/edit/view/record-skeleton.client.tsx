import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * What a record page shows while its record is still on the way.
 *
 * Until this existed the page drew itself at once from an empty form, so every field on it read
 * "Not filled in" for as long as the request took — a product with a name said it had none. A shape
 * with no words in it cannot say anything false, which is the whole of why this is here.
 *
 * It draws the record's own shape (the line back to the list, the card that names the record, then
 * the two columns) rather than a spinner, so nothing jumps when the real cards replace it.
 */
export class RecordSkeleton extends PureReactor {
  /** Rows per card; a record page's cards are short, so the default is what most of them hold. */
  @prop declare rows?: number;

  private bars(count: number, key: string): ReactNode {
    return Array.from({ length: count }, (_, index) => (
      <div className="fc-skeleton__row" key={`${key}-${index}`}>
        <span className="fc-skeleton fc-skeleton__label" />
        <span className="fc-skeleton fc-skeleton__value" />
      </div>
    ));
  }

  private card(key: string, rows: number): ReactNode {
    return (
      <div className="fc-record-card fc-skeleton-card" key={key}>
        <span className="fc-skeleton fc-skeleton__heading" />
        {this.bars(rows, key)}
      </div>
    );
  }

  render(): ReactNode {
    const rows = this.rows ?? 4;
    return (
      <div className="w-full flex flex-col" aria-busy="true" data-record-skeleton="true">
        <div className="fc-record-crumbs"><span className="fc-skeleton fc-skeleton__crumbs" /></div>
        <div className="fc-edit-columns">
          <div className="fc-edit-columns__grid fc-edit-columns__grid--sidebar">
            <div className="fc-edit-column">
              {this.card('main-1', rows)}
              {this.card('main-2', rows)}
            </div>
            <div className="fc-edit-column">
              {this.card('side-1', 3)}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
