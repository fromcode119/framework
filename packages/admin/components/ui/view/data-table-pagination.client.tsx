import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Pagination footer for {@link DataTable}. Renders nothing unless there is more than one page. */
export class DataTablePagination extends PureReactor {
  @prop declare totalDocs: number;
  @prop declare limit: number;
  @prop declare page: number;
  @prop declare onPageChange?: (page: number) => void;

  render(): ReactNode {
    const { totalDocs, limit, page, onPageChange } = this;
    const totalPages = Math.ceil(totalDocs / limit);
    if (totalPages <= 1) return null;

    const startRecord = totalDocs > 0 ? ((page - 1) * limit) + 1 : 0;
    const endRecord = totalDocs > 0 ? Math.min(page * limit, totalDocs) : 0;
    const maxPageButtons = 5;
    const windowStart = totalPages <= maxPageButtons
      ? 1
      : Math.min(Math.max(1, page - Math.floor(maxPageButtons / 2)), totalPages - maxPageButtons + 1);
    const windowEnd = totalPages <= maxPageButtons
      ? totalPages
      : Math.min(totalPages, windowStart + maxPageButtons - 1);
    const visiblePages = Array.from({ length: Math.max(0, windowEnd - windowStart + 1) }, (_, i) => windowStart + i);

    return (
        <div className="fc-dt-foot">
          <p className="fc-dt-foot__count">
            {AdminI18n.t('ui.table.showing', { from: startRecord, to: endRecord, total: totalDocs })}
          </p>
          <div className="fc-dt-pages">
            <button disabled={page === 1} onClick={() => onPageChange?.(page - 1)} className="fc-dt-page">
              <FrameworkIcons.Left size={14} />
            </button>
            <div className="fc-dt-pages">
              {windowStart > 1 && (
                <>
                  <button onClick={() => onPageChange?.(1)} className="fc-dt-page">1</button>
                  {windowStart > 2 && <span className="fc-dt-pages__gap">…</span>}
                </>
              )}
              {visiblePages.map((pageNum) => (
                <button key={pageNum} onClick={() => onPageChange?.(pageNum)}
                  className={`fc-dt-page${page === pageNum ? ' fc-dt-page--current' : ''}`} aria-current={page === pageNum ? 'page' : undefined}>
                  {pageNum}
                </button>
              ))}
              {windowEnd < totalPages && (
                <>
                  {windowEnd < totalPages - 1 && <span className="fc-dt-pages__gap">…</span>}
                  <button onClick={() => onPageChange?.(totalPages)} className="fc-dt-page">{totalPages}</button>
                </>
              )}
            </div>
            <button disabled={page === totalPages} onClick={() => onPageChange?.(page + 1)} className="fc-dt-page">
              <FrameworkIcons.Right size={14} />
            </button>
          </div>
        </div>
    );
  }
}
