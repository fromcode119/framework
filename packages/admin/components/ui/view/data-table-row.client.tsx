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
 * are therefore restated in opaque form (`.fc-dt-pinned` in admin.css) and follow the row's hover, so a
 * pinned cell still highlights with the row it belongs to instead of sitting there as a white gap.
 */
export class DataTableRow<T extends { id: any }> extends PureReactor {
  declare props: Pick<DataTableRow<T>, 'row' | 'columns' | 'selectable' | 'selected' | 'onToggleOne' | 'onRowClick' | 'actions' | 'stickyCount' | 'stickyOffsets' | 'stickyActions' | 'className'>;

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
  /** Extra classes for the row — a list marks where a dragged record will land with one. */
  @prop declare className?: string;

  private get pinnedClass(): string {
    // Opaque base + opaque restatements of the row states, so a pinned cell tracks its row.
    return 'sticky z-10 fc-dt-pinned';
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
        data-row-id={String(row.id)}
        className={`fc-dt-row ${this.onRowClick ? 'fc-dt-row--link' : ''} ${selected ? 'fc-dt-row--selected' : ''} ${this.className || ''}`}
        onClick={this.handleRowClick}
      >
        {selectable && (
          <td
            className={`fc-dt-td fc-dt-td--check ${stickyCount > 0 ? this.pinnedClass : ''}`}
            style={stickyCount > 0 ? { insetInlineStart: stickyOffsets[0] ?? 0 } : undefined}
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
              className={`fc-dt-td ${isPinned ? this.pinnedClass : ''} ${isPinned && index === stickyCount - 1 ? 'fc-dt-pinned-edge' : ''} ${col.className || ''}`}
              style={isPinned ? { insetInlineStart: columnOffsetAt(index) } : undefined}
            >
              <div className="fc-dt-cell">
                {typeof col.accessor === 'function' ? col.accessor(row) : (String(row[col.accessor]) || '-')}
              </div>
            </td>
          );
        })}
        {actions && (
          <td className={`fc-dt-td fc-dt-td--actions ${this.stickyActions ? 'sticky end-0 z-10 fc-dt-pinned fc-dt-pinned-end' : ''}`}>
            {actions(row)}
          </td>
        )}
      </tr>
    );
  }
}
