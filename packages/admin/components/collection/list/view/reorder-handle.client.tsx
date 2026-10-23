import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { GripVertical } from 'lucide-react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The grip a record is dragged by in a list with an order field (`admin.list.order`). Press and drag
 * moves the record; with the grip focused, the arrow keys move it one place up or down.
 *
 * Dragging only makes sense while the list shows every record in that order — sorted by the order
 * field, not searched or filtered. Otherwise the grip says so, and pressing it puts the list into that
 * order, so the operator is never left with a control that silently does nothing.
 */
export class CollectionListReorderHandle extends PureReactor {
  declare props: Pick<CollectionListReorderHandle, 'rowId' | 'enabled' | 'onPress' | 'onStep' | 'onEnable'>;

  @prop declare rowId: string;
  /** The list is in its own order, so a drag here means something. */
  @prop declare enabled: boolean;
  @prop declare onPress: (rowId: string, event: PointerEvent) => void;
  @prop declare onStep: (rowId: string, up: boolean) => void;
  /** Puts the list into its own order. */
  @prop declare onEnable: () => void;

  @bound private press(event: PointerEvent): void {
    if (!this.enabled) return;
    event.stopPropagation();
    this.onPress(this.rowId, event);
  }

  @bound private click(event: MouseEvent): void {
    // The row opens its record on click; the grip never does.
    event.stopPropagation();
    if (!this.enabled) this.onEnable();
  }

  @bound private key(event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.stopPropagation();
    if (this.enabled) this.onStep(this.rowId, event.key === 'ArrowUp');
  }

  render(): ReactNode {
    const label = this.enabled ? AdminI18n.t('collection.list.reorderHandle') : AdminI18n.t('collection.list.reorderEnable');
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        onPointerDown={this.press}
        onClick={this.click}
        onKeyDown={this.key}
        className={`fc-reorder-handle inline-flex items-center justify-center w-7 h-7 -my-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 ${this.enabled ? 'cursor-grab active:cursor-grabbing' : 'opacity-50 cursor-pointer'}`}
      >
        <GripVertical size={16} />
      </button>
    );
  }
}
