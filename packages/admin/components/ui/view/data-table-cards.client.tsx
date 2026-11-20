import { Fragment } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTableCard } from '@/components/ui/view/data-table-card.client';
import { Column } from '@/components/ui/column';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmptyState } from '@/components/ui/view/empty-state.client';

/**
 * A {@link DataTable} below desktop width. Every plugin screen built on DataTable used to keep its table on
 * a phone — squeezed into one-word columns or scrolled sideways — while the collection lists turned into
 * cards. This gives those screens the same cards, with no change at the call site.
 */
export class DataTableCards<T extends { id: any }> extends PureReactor {
  declare props: Pick<DataTableCards<T>, 'columns' | 'data' | 'loading' | 'emptyMessage' | 'selectable' | 'selectedIds' | 'onToggleOne' | 'onRowClick' | 'actions' | 'groupBy'>;

  @prop declare columns: Column<T>[];
  @prop declare data: T[];
  @prop declare loading?: boolean;
  @prop declare emptyMessage?: string;
  @prop declare selectable?: boolean;
  @prop declare selectedIds: string[];
  @prop declare onToggleOne?: (id: string, event: MouseEvent) => void;
  @prop declare onRowClick?: (row: T) => void;
  @prop declare actions?: (row: T) => ReactNode;
  @prop declare groupBy?: (row: T) => string;

  private renderEmpty(): ReactNode {
    return (
      <EmptyState icon={<FrameworkIcons.Search size={22} />} title={this.emptyMessage ?? AdminI18n.t('ui.table.empty')} />
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
          return (
            <Fragment key={String(row.id ?? index)}>
              {showGroupHeader ? (
                <div className="px-3 py-2 fc-tone-raised border-y fc-tone-line fc-size-xs font-medium fc-tone-muted">{groupKey}</div>
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
            </Fragment>
          );
        })}
      </div>
    );
  }
}
