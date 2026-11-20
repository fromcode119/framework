import type { DragEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { GripVertical } from 'lucide-react';
import { RepeatRow } from '@/components/ui/view/repeat-row.client';
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

  private get tools(): ReactNode {
    const { index, itemsLength } = this;
    const deleteLabel = AdminI18n.t('common.delete');
    return (
      <>
        {itemsLength > 1 ? (
          <>
            <button type="button" className="fc-repeat__tool" disabled={index === 0} onClick={() => this.onMoveUp(index)}
              title={AdminI18n.t('ui.array.moveUp')} aria-label={AdminI18n.t('ui.array.moveUp')}>
              <FrameworkIcons.ChevronUp size={14} />
            </button>
            <button type="button" className="fc-repeat__tool" onClick={() => this.onRemove(index)} title={deleteLabel} aria-label={deleteLabel}>
              <FrameworkIcons.Close size={14} />
            </button>
            <button type="button" className="fc-repeat__tool" disabled={index === itemsLength - 1} onClick={() => this.onMoveDown(index)}
              title={AdminI18n.t('ui.array.moveDown')} aria-label={AdminI18n.t('ui.array.moveDown')}>
              <FrameworkIcons.ChevronDown size={14} />
            </button>
            <span
              className="fc-repeat__tool fc-repeat__tool--grip"
              aria-hidden="true"
              onMouseEnter={() => this.onSetHandleHovered(index)}
              onMouseLeave={() => this.onSetHandleHovered(null)}
            >
              <GripVertical size={14} />
            </span>
          </>
        ) : (
          <button type="button" className="fc-repeat__tool" onClick={() => this.onRemove(index)} title={deleteLabel} aria-label={deleteLabel}>
            <FrameworkIcons.Close size={14} />
          </button>
        )}
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
