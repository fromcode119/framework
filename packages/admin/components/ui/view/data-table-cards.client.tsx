import { Fragment } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTableCard } from '@/components/ui/view/data-table-card.client';
import { Column } from '@/components/ui/column';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A {@link DataTable} below desktop width. Every plugin screen built on DataTable used to keep its table on
 * a phone — squeezed into one-word columns or scrolled sideways — while the collection lists turned into
 * cards. This gives those screens the same cards, with no change at the call site.
 */
export class DataTableCards<T extends { id: any }> extends PureReactor {
  declare props: Pick<DataTableCards<T>, 'columns' | 'data' | 'loading' | 'emptyMessage' | 'selectable' | 'selectedIds' | 'onToggleOne' | 'onRowClick' | 'actions' | 'expandedRowId' | 'renderExpandedRow' | 'groupBy'>;

  @prop declare columns: Column<T>[];
  @prop declare data: T[];
  @prop declare loading?: boolean;
  @prop declare emptyMessage?: string;
  @prop declare selectable?: boolean;
  @prop declare selectedIds: string[];
  @prop declare onToggleOne?: (id: string, event: MouseEvent) => void;
  @prop declare onRowClick?: (row: T) => void;
  @prop declare actions?: (row: T) => ReactNode;
  @prop declare expandedRowId?: string | null;
  @prop declare renderExpandedRow?: (row: T) => ReactNode;
  @prop declare groupBy?: (row: T) => string;

  private renderEmpty(): ReactNode {
    return (
      <div className="px-6 py-16 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:border-transparent">
          <FrameworkIcons.Search size={20} className="text-slate-400" />
        </div>
        <p className="font-semibold text-slate-400 text-[12px]">{this.emptyMessage ?? AdminI18n.t('ui.table.empty')}</p>
      </div>
    );
  }

  render(): ReactNode {
    const data = this.data;
    if (data.length === 0 && !this.loading) return this.renderEmpty();
    const groupBy = this.groupBy;
    return (
      <div>
        {data.map((row, index) => {
          const groupKey = groupBy ? (groupBy(row) || '—') : null;
          const showGroupHeader = groupKey !== null && (index === 0 || groupKey !== (groupBy!(data[index - 1]) || '—'));
          const isExpanded = this.expandedRowId != null && String(this.expandedRowId) === String(row.id);
          return (
            <Fragment key={String(row.id ?? index)}>
              {showGroupHeader ? (
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/60 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{groupKey}</div>
              ) : null}
              <DataTableCard
                row={row}
                columns={this.columns}
                selectable={this.selectable}
                selected={this.selectedIds.includes(String(row.id))}
                onToggleOne={this.onToggleOne}
                onRowClick={this.onRowClick}
                actions={this.actions}
              />
              {isExpanded && this.renderExpandedRow ? <div className="px-4 pb-4 bg-indigo-50/20 dark:bg-indigo-500/5">{this.renderExpandedRow(row)}</div> : null}
            </Fragment>
          );
        })}
      </div>
    );
  }
}
