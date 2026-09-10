import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Column } from '@/components/ui/column';

/**
 * One record's row.
 *
 * Pinned cells carry their own OPAQUE background, because the row's hover and selected tints are
 * translucent and a pinned cell wearing one would let the scrolled columns show through it. The tints
 * are therefore restated here in opaque form and driven off the row's `group` hover, so a pinned cell
 * still highlights with the row it belongs to instead of sitting there as a white gap.
 */
export class DataTableRow<T extends { id: any }> extends PureReactor {
  declare props: Pick<DataTableRow<T>, 'row' | 'columns' | 'selectable' | 'selected' | 'onToggleOne' | 'onRowClick' | 'actions' | 'stickyCount' | 'stickyOffsets' | 'stickyActions'>;

  @prop declare row: T;
  @prop declare columns: Column<T>[];
  @prop declare selectable?: boolean;
  @prop declare selected?: boolean;
  @prop declare onToggleOne?: (id: string, event: MouseEvent) => void;
  @prop declare onRowClick?: (row: T) => void;
  @prop declare actions?: (row: T) => ReactNode;
  @prop declare stickyCount: number;
  @prop declare stickyOffsets: number[];
  @prop declare stickyActions?: boolean;

  private get pinnedClass(): string {
    // Opaque base + opaque restatements of the row states, so a pinned cell tracks its row.
    return `sticky z-10 ${this.selected
      ? 'bg-indigo-50 dark:bg-slate-900'
      : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800'}`;
  }

  @bound private handleRowClick(): void {
    this.onRowClick?.(this.row);
  }

  @bound private handleToggleOne(event: MouseEvent): void {
    this.onToggleOne?.(String(this.row.id), event);
  }

  render(): ReactNode {
    const { row, columns, selectable, selected, actions, stickyCount, stickyOffsets } = this;
    const columnOffsetAt = (index: number): number => stickyOffsets[index + (selectable ? 1 : 0)] ?? 0;

    return (
      <tr
        className={`group transition-all duration-200 cursor-default hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${this.onRowClick ? 'cursor-pointer' : ''} ${selected ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''}`}
        onClick={this.handleRowClick}
      >
        {selectable && (
          <td
            className={`px-3 py-2.5 w-4 ${stickyCount > 0 ? this.pinnedClass : ''}`}
            style={stickyCount > 0 ? { left: stickyOffsets[0] ?? 0 } : undefined}
            onClick={this.handleToggleOne}
          >
            {/* The cell's onClick above carries the event (shift-range select), so the box renders
                presentational — a Checkbox with its own handler would fire the toggle twice. */}
            <Checkbox checked={selected} presentational />
          </td>
        )}
        {columns.map((col, index) => {
          const isPinned = index < stickyCount;
          return (
            <td
              key={col.id}
              className={`px-3 py-2.5 ${isPinned ? this.pinnedClass : ''} ${isPinned && index === stickyCount - 1 ? 'border-r border-slate-200 dark:border-slate-700' : ''} ${col.className || ''}`}
              style={isPinned ? { left: columnOffsetAt(index) } : undefined}
            >
              <div className="text-[13px] font-semibold tracking-tight text-slate-700 dark:text-slate-300">
                {typeof col.accessor === 'function' ? col.accessor(row) : (String(row[col.accessor]) || '-')}
              </div>
            </td>
          );
        })}
        {actions && (
          <td className={`px-3 py-2 text-right ${this.stickyActions
            ? `sticky right-0 z-10 border-l border-slate-200 dark:border-slate-700 ${selected ? 'bg-indigo-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800'}`
            : ''}`}
          >
            {actions(row)}
          </td>
        )}
      </tr>
    );
  }
}
