import type { ReactNode, RefObject } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { FrameworkIcons } from '@fromcode119/react';
import { Column } from '@/components/ui/column';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The table's header row, and the row whose cell widths every pinned offset is measured from.
 *
 * A pinned cell needs an OPAQUE background: the header's own tint is translucent, so a
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
  private static readonly PINNED = 'sticky z-20 fc-dt-pinned';
  private static readonly PINNED_EDGE = 'fc-dt-pinned-edge';
  private static readonly PINNED_END = 'sticky end-0 z-20 fc-dt-pinned fc-dt-pinned-end';

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
        <tr ref={this.rowRef} className="fc-dt-head">
          {selectable && (
            <th
              className={`fc-dt-th fc-dt-th--check ${stickyCount > 0 ? DataTableHead.PINNED : ''}`}
              style={stickyCount > 0 ? { insetInlineStart: checkboxOffset ?? 0 } : undefined}
            >
              <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={this.handleToggleAll} />
            </th>
          )}
          {columns.map((col, index) => {
            const isPinned = index < stickyCount;
            return (
              <th
                key={col.id}
                className={`fc-dt-th ${col.sortable ? 'fc-dt-th--sortable' : ''} ${isPinned ? DataTableHead.PINNED : ''} ${isPinned && index === stickyCount - 1 ? DataTableHead.PINNED_EDGE : ''} ${col.className || ''}`}
                style={isPinned ? { insetInlineStart: columnOffsetAt(index) ?? 0 } : undefined}
                onClick={() => col.sortable && this.onSort?.(col.id)}
              >
                <div className="fc-dt-th__inner">
                  {col.header}
                  {col.sortable && this.sortIcon(col.id)}
                </div>
              </th>
            );
          })}
          {hasActions && (
            // The row's own controls say what they do; a column heading over them would only repeat it.
            <th className={`fc-dt-th fc-dt-th--actions ${this.stickyActions ? DataTableHead.PINNED_END : ''}`}>
              <span className="sr-only">{AdminI18n.t('ui.table.actions')}</span>
            </th>
          )}
        </tr>
      </thead>
    );
  }
}
