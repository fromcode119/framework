import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What closes a read-only table: which rows of how many are on screen, and the way to the next of them.
 *
 * Both halves are measured, not decorative. The range answers the first question anyone asks of a list —
 * is this all of it — and the pager appears only where there is more than one page, so a table that
 * shows everything it holds carries no control that would do nothing.
 */
export class StructuredReadOnlyTableFoot extends PureReactor {
  @prop declare from: number;
  @prop declare to: number;
  @prop declare total: number;
  @prop declare page: number;
  @prop declare pages: number;
  @prop declare onPage: (page: number) => void;

  render(): ReactNode {
    const { page, pages } = this;
    return (
      <div className="fc-sro-table__foot">
        <span className="fc-sro-table__count">
          {AdminI18n.t('ui.structured.tableRange', { from: this.from, to: this.to, total: this.total })}
        </span>
        {pages > 1 ? (
          <span className="fc-sro-table__pager">
            <span className="fc-sro-table__pages">{AdminI18n.t('ui.structured.tablePages', { page, pages })}</span>
            <button type="button" className="fc-sro-table__page" disabled={page <= 1} onClick={() => this.onPage(page - 1)}>
              {AdminI18n.t('ui.structured.tablePrev')}
            </button>
            <button type="button" className="fc-sro-table__page" disabled={page >= pages} onClick={() => this.onPage(page + 1)}>
              {AdminI18n.t('ui.structured.tableNext')}
            </button>
          </span>
        ) : null}
      </div>
    );
  }
}
