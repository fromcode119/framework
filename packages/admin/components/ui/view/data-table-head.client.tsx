import type { ReactNode, RefObject } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Column } from '@/components/ui/column';

/**
 * The table's header row, and the row whose cell widths every pinned offset is measured from.
 *
 * A pinned cell needs an OPAQUE background: the header's own `bg-slate-100/50` is translucent, so a
 * pinned cell keeping it would show the columns scrolling underneath straight through the text.
 */
export class DataTableHead<T extends { id: any }> extends PureReactor {
  declare props: Pick<DataTableHead<T>, 'columns' | 'rowRef' | 'selectable' | 'allSelected' | 'someSelected' | 'onToggleAll' | 'onSort' | 'currentSort' | 'hasActions' | 'stickyCount' | 'stickyOffsets' | 'stickyActions'>;

  @prop declare columns: Column<T>[];
  @prop declare rowRef: RefObject<HTMLTableRowElement | null>;
  @prop declare selectable?: boolean;
  @prop declare allSelected?: boolean;
  @prop declare someSelected?: boolean;
  @prop declare onToggleAll?: () => void;
  @prop declare onSort?: (columnId: string) => void;
  @prop declare currentSort?: string;
  @prop declare hasActions?: boolean;
  /** How many leading columns are pinned — they render as one run at the left edge. */
  @prop declare stickyCount: number;
  @prop declare stickyOffsets: number[];
  @prop declare stickyActions?: boolean;

  /** Opaque so scrolled columns cannot show through, and a divider so the run reads as pinned. */
  private static readonly PINNED = 'sticky z-20 bg-slate-100 dark:bg-slate-900';
  private static readonly PINNED_EDGE = 'border-r border-slate-200 dark:border-slate-700';

  private sortIcon(columnId: string): ReactNode {
    if (this.currentSort === columnId) return <FrameworkIcons.Up size={12} />;
    if (this.currentSort === `-${columnId}`) return <FrameworkIcons.Down size={12} />;
    return <FrameworkIcons.Down size={12} className="opacity-20" />;
  }

  @bound private handleToggleAll(): void {
    this.onToggleAll?.();
  }

  render(): ReactNode {
    const { columns, selectable, allSelected, someSelected, hasActions, stickyCount, stickyOffsets } = this;
    // The checkbox occupies the edge, so it is pinned too and takes the first measured offset.
    const checkboxOffset = selectable ? stickyOffsets[0] : undefined;
    const columnOffsetAt = (index: number): number | undefined => stickyOffsets[index + (selectable ? 1 : 0)];

    return (
      <thead>
        <tr ref={this.rowRef} className="bg-slate-100/50 border-b border-slate-200/60 dark:bg-slate-900/50 dark:border-slate-800">
          {selectable && (
            <th
              className={`px-3 py-3 w-4 ${stickyCount > 0 ? DataTableHead.PINNED : ''}`}
              style={stickyCount > 0 ? { left: checkboxOffset ?? 0 } : undefined}
            >
              <div
                onClick={this.handleToggleAll}
                className={`w-4 h-4 rounded border-2 cursor-pointer transition-all flex items-center justify-center ${
                  allSelected
                    ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20'
                    : someSelected
                      ? 'bg-indigo-600/50 border-indigo-600'
                      : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
                }`}
              >
                {someSelected && !allSelected && <div className="w-2 h-0.5 bg-white rounded-full" />}
                {allSelected && <FrameworkIcons.Check size={10} className="text-white" strokeWidth={3} />}
              </div>
            </th>
          )}
          {columns.map((col, index) => {
            const isPinned = index < stickyCount;
            return (
              <th
                key={col.id}
                className={`px-3 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide ${col.sortable ? 'cursor-pointer hover:text-indigo-500 transition-colors' : ''} ${isPinned ? DataTableHead.PINNED : ''} ${isPinned && index === stickyCount - 1 ? DataTableHead.PINNED_EDGE : ''} ${col.className || ''}`}
                style={isPinned ? { left: columnOffsetAt(index) ?? 0 } : undefined}
                onClick={() => col.sortable && this.onSort?.(col.id)}
              >
                <div className="flex items-center gap-2">
                  {col.header}
                  {col.sortable && this.sortIcon(col.id)}
                </div>
              </th>
            );
          })}
          {hasActions && (
            <th className={`px-3 py-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 text-right tracking-wide ${
              this.stickyActions ? 'sticky right-0 z-20 bg-slate-100 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700' : ''
            }`}>
              Actions
            </th>
          )}
        </tr>
      </thead>
    );
  }
}
