import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { DragEvent, ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { RepeatRow } from '@/components/ui/view/repeat-row.client';
import { RepeatRowGrip } from '@/components/ui/view/repeat-row-grip.client';

/**
 * A menu built row by row: each item is a RepeatRow moved in by its depth. Its handle drags it, or moves
 * it with the arrow keys: up and down to reorder, right to nest it under the item above, left to move it
 * out a level.
 */
export class VisualMenuField extends PureReactor {
  @prop declare field: any;
  @prop declare value: any[];
  @prop declare onChange: (value: any[]) => void;
  @prop declare theme?: ThemeMode;
  @prop declare collectionSlug: string;
  @state private dragged: number | null = null;
  @state private handleHovered: number | null = null;

  get items(): any[] {
    return Array.isArray(this.value) ? this.value : [];
  }

  @bound
  handleAddItem(): void {
    const newItem: Record<string, any> = {
      label: AdminI18n.t('ui.menuField.newItem'),
      type: 'url',
      url: '/',
      parent: null,
      depth: 0
    };
    this.onChange([...this.items, newItem]);
  }

  @bound
  handleRemoveItem(index: number): void {
    const newItems = [...this.items];
    newItems.splice(index, 1);
    this.onChange(newItems);
  }

  @bound
  handleUpdateItem(index: number, name: string, val: any): void {
    const newItems = [...this.items];
    newItems[index] = { ...newItems[index], [name]: val };
    this.onChange(newItems);
  }

  @bound
  handleMoveUp(index: number): void {
    if (index === 0) return;
    const newItems = [...this.items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    this.onChange(newItems);
  }

  @bound
  handleMoveDown(index: number): void {
    if (index === this.items.length - 1) return;
    const newItems = [...this.items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    this.onChange(newItems);
  }

  @bound
  handleIndent(index: number, direction: HorizontalAlign): void {
    const newItems = [...this.items];
    const currentDepth = newItems[index].depth || 0;

    if (direction === HorizontalAlign.RIGHT) {
        // Can only indent if the previous item is at least at the same depth
        if (index > 0 && (newItems[index - 1].depth || 0) >= currentDepth) {
            newItems[index] = { ...newItems[index], depth: currentDepth + 1 };
        }
    } else {
        if (currentDepth > 0) {
            newItems[index] = { ...newItems[index], depth: currentDepth - 1 };
        }
    }
    this.onChange(newItems);
  }

  @bound
  renderFieldInput(f: any, item: any, index: number): ReactNode {
    let val = item[f.name];

    // A relationship stored as an object where a string is expected.
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      val = val.value || val.slug || val.id || val.label || '';
    }

    const onChange = (v: any) => this.handleUpdateItem(index, f.name, v?.target ? v.target.value : v);

    if (f.type === 'relationship') {
      return (
        <TagField
          value={val}
          onChange={onChange}
          theme={this.theme}
          collectionSlug={this.collectionSlug}
          fieldName={f.name}
          sourceCollection={f.admin?.sourceCollection || f.relationTo}
          sourceField={f.admin?.sourceField || 'slug'}
          hasMany={false}
          allowCreate={false}
        />
      );
    }

    if (f.type === 'select') {
      return <Select value={val} onChange={onChange} options={f.options || []} placeholder={f.placeholder} />;
    }

    return <Input value={val} onChange={onChange} placeholder={f.placeholder} type="text" />;
  }

  /** The arrow key pressed on a row's handle; the answer is where the row is now, or null. */
  private move(index: number, key: string): number | null {
    const item = this.items[index];
    const depth = item.depth || 0;
    if (key === 'ArrowUp' && index > 0) { this.handleMoveUp(index); return index - 1; }
    if (key === 'ArrowDown' && index < this.items.length - 1) { this.handleMoveDown(index); return index + 1; }
    if (key === 'ArrowRight' && index > 0 && (this.items[index - 1].depth || 0) >= depth) { this.handleIndent(index, HorizontalAlign.RIGHT); return index; }
    if (key === 'ArrowLeft' && depth > 0) { this.handleIndent(index, HorizontalAlign.LEFT); return index; }
    return null;
  }

  private reorder(from: number, to: number): void {
    const next = [...this.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.onChange(next);
  }

  private tools(index: number): ReactNode {
    const deleteLabel = AdminI18n.t('common.delete');
    return (
      <>
        <button type="button" className="fc-repeat__tool" onClick={() => this.handleRemoveItem(index)} title={deleteLabel} aria-label={deleteLabel}>
          <FrameworkIcons.Close size={14} />
        </button>
        <RepeatRowGrip
          label={AdminI18n.t('ui.menuField.reorder')}
          onMove={(key: string) => this.move(index, key)}
          onHover={(on: boolean) => { this.handleHovered = on ? index : null; }}
        />
      </>
    );
  }

  render(): ReactNode {
    const subFields = (this.field?.fields || []) as any[];
    return (
      <div className="fc-repeat">
        {this.items.length ? (
          <ul className="fc-repeat__rows">
            {this.items.map((item, index) => (
              <RepeatRow
                key={index}
                depth={item.depth || 0}
                fields={subFields
                  .filter((f: any) => !f.admin?.condition || f.admin.condition({}, item))
                  .map((f: any) => ({ key: f.name, label: f.label, control: this.renderFieldInput(f, item, index) }))}
                tools={this.tools(index)}
                dragging={this.dragged === index}
                draggable={this.handleHovered === index || this.dragged === index}
                onDragStart={(e: DragEvent<HTMLLIElement>) => { this.dragged = index; e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e: DragEvent<HTMLLIElement>) => {
                  e.preventDefault();
                  if (this.dragged === null || this.dragged === index) return;
                  this.reorder(this.dragged, index);
                  this.dragged = index;
                }}
                onDragEnd={() => { this.dragged = null; this.handleHovered = null; }}
              />
            ))}
          </ul>
        ) : null}
        <Button type="button" variant={ButtonVariant.SECONDARY} size={FieldSize.SM} onClick={this.handleAddItem} icon={<FrameworkIcons.Plus size={13} />}>
          {AdminI18n.t('ui.menuField.add')}
        </Button>
      </div>
    );
  }
}
