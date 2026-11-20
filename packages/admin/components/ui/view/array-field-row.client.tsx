import type { DragEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { RepeatRow } from '@/components/ui/view/repeat-row.client';
import { RepeatRowGrip } from '@/components/ui/view/repeat-row-grip.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ArrayFieldRow extends PureReactor {
  @prop declare field: any;
  @prop declare item: any;
  @prop declare index: number;
  @prop declare itemsLength: number;
  @prop declare draggedIndex: number | null;
  @prop declare isHandleHovered: number | null;
  @prop declare renderField: (f: any, item: any, index: number) => ReactNode;
  @prop declare onSetDragged: (index: number | null) => void;
  @prop declare onSetHandleHovered: (index: number | null) => void;
  @prop declare onReorder: (fromIndex: number, toIndex: number) => void;
  @prop declare onMoveUp: (index: number) => void;
  @prop declare onMoveDown: (index: number) => void;
  @prop declare onRemove: (index: number) => void;

  /** Up and down move the row one place; the answer is where it went. */
  private move(key: string): number | null {
    const { index, itemsLength } = this;
    if (key === 'ArrowUp' && index > 0) { this.onMoveUp(index); return index - 1; }
    if (key === 'ArrowDown' && index < itemsLength - 1) { this.onMoveDown(index); return index + 1; }
    return null;
  }

  private get tools(): ReactNode {
    const deleteLabel = AdminI18n.t('common.delete');
    return (
      <>
        <button type="button" className="fc-repeat__tool" onClick={() => this.onRemove(this.index)} title={deleteLabel} aria-label={deleteLabel}>
          <FrameworkIcons.Close size={14} />
        </button>
        {this.itemsLength > 1 ? (
          <RepeatRowGrip
            label={AdminI18n.t('ui.array.reorder')}
            onMove={(key: string) => this.move(key)}
            onHover={(on: boolean) => this.onSetHandleHovered(on ? this.index : null)}
          />
        ) : null}
      </>
    );
  }

  render(): ReactNode {
    const { field, item, index, draggedIndex, isHandleHovered } = this;
    const visibleFields = field.fields.filter((f: any) => !f.admin?.condition || f.admin.condition({}, item));

    return (
      <RepeatRow
        fields={visibleFields.map((f: any) => ({ key: f.name, label: f.label, control: this.renderField(f, item, index) }))}
        tools={this.tools}
        dragging={draggedIndex === index}
        draggable={isHandleHovered === index || draggedIndex === index}
        onDragStart={(e: DragEvent<HTMLLIElement>) => {
          this.onSetDragged(index);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e: DragEvent<HTMLLIElement>) => {
          e.preventDefault();
          if (draggedIndex === null || draggedIndex === index) return;
          this.onReorder(draggedIndex, index);
          this.onSetDragged(index);
        }}
        onDragEnd={() => {
          this.onSetDragged(null);
          this.onSetHandleHovered(null);
        }}
      />
    );
  }
}
