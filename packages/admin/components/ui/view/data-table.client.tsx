import { Fragment } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { DataTablePagination } from '@/components/ui/view/data-table-pagination.client';
import { DataTableHead } from '@/components/ui/view/data-table-head.client';
import { DataTableRow } from '@/components/ui/view/data-table-row.client';
import { StickyColumnLayout } from '@/components/ui/sticky-column-layout';
import { Column } from '@/components/ui/column';

/** Generic paginated, sortable, selectable data table. Pure presentational class. */
export class DataTable<T extends { id: any }> extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<DataTable<T>, 'columns' | 'data' | 'loading' | 'totalDocs' | 'limit' | 'page' | 'onPageChange' | 'onSort' | 'currentSort' | 'onRowClick' | 'actions' | 'emptyMessage' | 'selectable' | 'selectedIds' | 'onSelectionChange' | 'expandedRowId' | 'renderExpandedRow' | 'groupBy' | 'stickyColumnIds' | 'stickyActions'>;

  @prop declare columns: Column<T>[];
  @prop declare data: T[];
  @prop declare loading?: boolean;
  @prop declare totalDocs?: number;
  @prop declare limit?: number;
  @prop declare page?: number;
  @prop declare onPageChange?: (page: number) => void;
  @prop declare onSort?: (sort: string) => void;
  @prop declare currentSort?: string;
  @prop declare onRowClick?: (row: T) => void;
  @prop declare actions?: (row: T) => ReactNode;
  @prop declare emptyMessage?: string;
  @prop declare selectable?: boolean;
  @prop declare selectedIds?: string[];
  @prop declare onSelectionChange?: (ids: string[]) => void;
  @prop declare expandedRowId?: string | null;
  @prop declare renderExpandedRow?: (row: T) => ReactNode;
  @prop declare groupBy?: (row: T) => string;
  /** Columns pinned to the left edge, in the order they were pinned. */
  @prop declare stickyColumnIds?: string[];
  /**
   * The row's actions stay reachable while the table scrolls sideways — the default, because a wide
   * table otherwise pushes Edit and Delete off-screen and the row cannot be acted on at all.
   */
  @prop declare stickyActions?: boolean;

  /** Measured left offsets for the pinned run, checkbox column included. */
  @state stickyOffsets: number[] = [];

  private headRow = this.ref<HTMLTableRowElement>();

  private get pinnedIds(): string[] {
    return this.stickyColumnIds ?? [];
  }

  private get orderedColumns(): Column<T>[] {
    return StickyColumnLayout.order(this.columns, this.pinnedIds);
  }

  private get pinnedCount(): number {
    return StickyColumnLayout.pinnedCount(this.columns, this.pinnedIds);
  }

  private get isActionsPinned(): boolean {
    return Boolean(this.actions) && this.stickyActions !== false;
  }

  componentDidMount(): void {
    this.measureStickyOffsets();
    // A column's width is whatever its content needs, so it changes with the viewport.
    this.listen(window, 'resize', this.measureStickyOffsets);
  }

  componentDidUpdate(): void {
    this.measureStickyOffsets();
  }

  /**
   * Reads the real header cell widths, because the table lays out `auto` — no static value can know
   * how wide a column of order numbers or customer names ends up.
   */
  @bound private measureStickyOffsets(): void {
    const row = this.headRow.current;
    if (!row) return;

    const pinnedCells = this.pinnedCount + (this.selectable ? 1 : 0);
    const widths = Array.from(row.children)
      .slice(0, this.pinnedCount > 0 ? pinnedCells : 0)
      .map((cell) => (cell as HTMLElement).getBoundingClientRect().width);

    const next = StickyColumnLayout.leftOffsets(widths);
    // Guarded because this runs from componentDidUpdate — assigning an equal-but-new array every pass
    // would re-render forever.
    const current = this.stickyOffsets;
    if (next.length === current.length && next.every((value, index) => value === current[index])) return;
    this.stickyOffsets = next;
  }

  @bound private toggleAll(): void {
    const onSelectionChange = this.onSelectionChange;
    if (!onSelectionChange) return;
    const selectedIds = this.selectedIds ?? [];
    if (selectedIds.length === this.data.length) onSelectionChange([]);
    else onSelectionChange(this.data.map((row) => String(row.id)));
  }

  @bound private toggleOne(id: string, event: MouseEvent): void {
    event.stopPropagation();
    const onSelectionChange = this.onSelectionChange;
    if (!onSelectionChange) return;
    const selectedIds = this.selectedIds ?? [];
    const stringId = String(id);
    if (selectedIds.includes(stringId)) onSelectionChange(selectedIds.filter((existing) => existing !== stringId));
    else onSelectionChange([...selectedIds, stringId]);
  }

  @bound private handleSort(columnId: string): void {
    const onSort = this.onSort;
    if (!onSort) return;
    onSort(this.currentSort === `-${columnId}` ? columnId : `-${columnId}`);
  }

  private renderEmpty(totalColumns: number): ReactNode {
    return (
      <tr>
        <td colSpan={totalColumns} className="px-6 py-24 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:border-transparent">
              <FrameworkIcons.Search size={22} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-400 tracking-wide text-[12px]">{this.emptyMessage ?? 'No records found'}</p>
          </div>
        </td>
      </tr>
    );
  }

  render(): ReactNode {
    const data = this.data;
    const columns = this.orderedColumns;
    const selectable = this.selectable;
    const selectedIds = this.selectedIds ?? [];
    const groupBy = this.groupBy;
    const totalColumns = columns.length + (this.actions ? 1 : 0) + (selectable ? 1 : 0);

    const groupCounts: Record<string, number> = {};
    if (groupBy) for (const row of data) { const key = groupBy(row) || '—'; groupCounts[key] = (groupCounts[key] || 0) + 1; }

    return (
      <div className={`flex flex-col w-full h-full transition-all duration-300 ${this.loading ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <DataTableHead
              columns={columns}
              rowRef={this.headRow}
              selectable={selectable}
              allSelected={selectedIds.length > 0 && selectedIds.length === data.length}
              someSelected={selectedIds.length > 0}
              onToggleAll={this.toggleAll}
              onSort={this.handleSort}
              currentSort={this.currentSort}
              hasActions={Boolean(this.actions)}
              stickyCount={this.pinnedCount}
              stickyOffsets={this.stickyOffsets}
              stickyActions={this.isActionsPinned}
            />
            <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/50">
              {data.length === 0 && !this.loading ? this.renderEmpty(totalColumns) : data.map((row, index) => {
                const rowKey = String(row.id || (row as any).key || (row as any).slug || index);
                const isExpanded = this.expandedRowId != null && String(this.expandedRowId) === String(row.id);
                const groupKey = groupBy ? (groupBy(row) || '—') : null;
                const showGroupHeader = groupKey !== null && (index === 0 || groupKey !== (groupBy!(data[index - 1]) || '—'));

                return (
                  <Fragment key={rowKey}>
                    {showGroupHeader && (
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/60 dark:border-slate-800">
                        <td colSpan={totalColumns} className="px-3 py-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{groupKey}</span>
                          <span className="ml-2 text-[11px] font-semibold text-slate-400">{groupCounts[groupKey!]}</span>
                        </td>
                      </tr>
                    )}
                    <DataTableRow
                      row={row}
                      columns={columns}
                      selectable={selectable}
                      selected={selectedIds.includes(String(row.id))}
                      onToggleOne={this.toggleOne}
                      onRowClick={this.onRowClick}
                      actions={this.actions}
                      stickyCount={this.pinnedCount}
                      stickyOffsets={this.stickyOffsets}
                      stickyActions={this.isActionsPinned}
                    />
                    {isExpanded && this.renderExpandedRow && (
                      <tr className="bg-indigo-50/20 dark:bg-indigo-500/5">
                        <td className="px-3 py-4" colSpan={totalColumns}>{this.renderExpandedRow(row)}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <DataTablePagination
          totalDocs={this.totalDocs ?? 0}
          limit={this.limit ?? 10}
          page={this.page ?? 1}
          onPageChange={this.onPageChange}
        />
      </div>
    );
  }
}
