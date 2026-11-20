import { ReorderDirection } from '@/components/collection/list/enums/reorder-direction.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { DragEvent, ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { RepeatRowGrip } from '@/components/ui/view/repeat-row-grip.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The column chooser of a list, as the reference draws it: an icon in the toolbar opening a menu with a
 * checkbox per column. It is a Dropdown like the order beside it, so the list card cannot clip it.
 * Ours also pins a column to the left edge and orders the shown ones — the order by the row's handle
 * (dragged, or focused and moved with the arrow keys), not by a pair of arrows on every row.
 */
export class CollectionColumnsMenu extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare allColumns: any[];
  @prop declare visibleColumnIds: string[];
  @prop declare toggleColumn: (id: string) => void;
  @prop declare reorderColumn: (id: string, direction: ReorderDirection) => void;
  /** Columns pinned to the left edge of the table, in pinning order. */
  @prop declare stickyColumnIds: string[];
  @prop declare toggleStickyColumn: (id: string) => void;

  /** The shown column being dragged, and whether the pointer is on a handle (only then may a row move). */
  @state private dragged: string | null = null;
  @state private held = false;

  /** Moves a shown column from one place to another, one step at a time through the page's own reorder. */
  private moveTo(id: string, to: number): void {
    const from = this.visibleColumnIds.indexOf(id);
    if (from === -1 || to === from || to < 0 || to >= this.visibleColumnIds.length) return;
    const direction = to < from ? ReorderDirection.UP : ReorderDirection.DOWN;
    for (let step = 0; step < Math.abs(to - from); step++) this.reorderColumn(id, direction);
  }

  private moveByKey(id: string, index: number, key: string): number | null {
    const to = key === 'ArrowUp' ? index - 1 : key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= this.visibleColumnIds.length) return null;
    this.moveTo(id, to);
    return to;
  }

  private dropOn(event: DragEvent<HTMLLIElement>, index: number): void {
    event.preventDefault();
    if (this.dragged) this.moveTo(this.dragged, index);
    this.dragged = null;
  }

  private renderShown(column: any, index: number, count: number): ReactNode {
    const pinned = this.stickyColumnIds.includes(column.id);
    const pinLabel = AdminI18n.t(pinned ? 'collection.list.unpin' : 'collection.list.pin');
    return (
      <li
        key={column.id}
        className="fc-columns-menu__row"
        data-dragging={this.dragged === column.id ? 'true' : undefined}
        draggable={count > 1 && this.held}
        onDragStart={() => { this.dragged = column.id; }}
        onDragEnd={() => { this.dragged = null; }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => this.dropOn(event, index)}
      >
        <Checkbox className="fc-columns-menu__check" checked label={column.header} onChange={() => this.toggleColumn(column.id)} />
        <button type="button" className="fc-repeat__tool" aria-pressed={pinned} title={pinLabel} aria-label={pinLabel} onClick={() => this.toggleStickyColumn(column.id)}>
          <FrameworkIcons.Pin size={14} />
        </button>
        {count > 1 ? (
          <RepeatRowGrip label={AdminI18n.t('ui.array.reorder')} onMove={(key: string) => this.moveByKey(column.id, index, key)} onHover={(on: boolean) => { this.held = on; }} />
        ) : null}
      </li>
    );
  }

  render(): ReactNode {
    return (
      <Dropdown
        align={HorizontalAlign.RIGHT}
        trigger={
          <span title={AdminI18n.t('collection.list.columns')} aria-label={AdminI18n.t('collection.list.columns')} className="fc-toolbar-btn fc-toolbar-btn--icon">
            <FrameworkIcons.Layout size={15} />
          </span>
        }
        items={[]}
        panel={this.renderPanel()}
      />
    );
  }

  private renderPanel(): ReactNode {
    const { allColumns, visibleColumnIds, toggleColumn } = this;
    const shown = visibleColumnIds.map((id) => allColumns.find((c) => c.id === id)).filter(Boolean);
    const hidden = allColumns.filter((c) => !visibleColumnIds.includes(c.id));
    return (
      <div className="fc-columns-menu">
        <div className="fc-menu-section">{AdminI18n.t('collection.list.visibleColumns')}</div>
        <p className="fc-columns-menu__hint">{AdminI18n.t('collection.list.pinnedHint')}</p>
        <div className="fc-columns-menu__scroll">
          <ul className="fc-repeat__rows fc-columns-menu__rows">
            {shown.map((column: any, index: number) => this.renderShown(column, index, shown.length))}
          </ul>
          {hidden.length > 0 ? (
            <>
              <div className="fc-menu-section">{AdminI18n.t('collection.list.hidden')}</div>
              <ul className="fc-columns-menu__rows">
                {hidden.map((column: any) => (
                  <li key={column.id} className="fc-columns-menu__row">
                    <Checkbox className="fc-columns-menu__check" checked={false} label={column.header} onChange={() => toggleColumn(column.id)} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    );
  }
}
