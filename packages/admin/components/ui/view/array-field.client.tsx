import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ArrayFieldRow } from '@/components/ui/view/array-field-row.client';
import { ArrayFieldRowRenderer } from '@/components/ui/view/array-field-row-renderer.client';
import { ArrayFieldTable } from '@/components/ui/view/array-field-table.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ArrayField extends Reactor {
  @prop declare field: any;
  @prop declare value: any[];
  @prop declare onChange: (value: any[]) => void;
  @prop declare theme?: ThemeMode;
  @prop declare collectionSlug: string;
  @prop declare pluginSettings?: Record<string, any>;
  @prop declare fieldComponents?: Record<string, any>;

  @state private draggedIndex: number | null = null;
  @state private isHandleHovered: number | null = null;

  private get items(): any[] {
    return Array.isArray(this.value) ? this.value : [];
  }

  @bound
  private handleAddItem(): void {
    const newItem: Record<string, any> = {};
    this.field.fields.forEach((f: any) => {
      newItem[f.name] = f.defaultValue !== undefined ? f.defaultValue : null;
    });
    this.onChange([...this.items, newItem]);
  }

  @bound
  private handleRemoveItem(index: number): void {
    const newItems = [...this.items];
    newItems.splice(index, 1);
    this.onChange(newItems);
  }

  @bound
  private handleReorder(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const newItems = [...this.items];
    const item = newItems.splice(fromIndex, 1)[0];
    newItems.splice(toIndex, 0, item);
    this.onChange(newItems);
  }

  @bound
  private handleUpdateItem(index: number, name: string, val: any): void {
    const newItems = [...this.items];
    const nextItem = { ...newItems[index], [name]: val };
    newItems[index] = nextItem;
    this.onChange(newItems);
  }

  @bound
  private handleMoveUp(index: number): void {
    if (index === 0) return;
    this.handleReorder(index, index - 1);
  }

  @bound
  private handleMoveDown(index: number): void {
    if (index === this.items.length - 1) return;
    this.handleReorder(index, index + 1);
  }

  @bound
  private handleSetDragged(value: number | null): void {
    this.draggedIndex = value;
  }

  @bound
  private handleSetHandleHovered(value: number | null): void {
    this.isHandleHovered = value;
  }

  @bound
  private renderField(f: any, item: any, index: number): React.ReactNode {
    return (
      <ArrayFieldRowRenderer
        field={f}
        item={item}
        index={index}
        theme={this.theme}
        collectionSlug={this.collectionSlug}
        pluginSettings={this.pluginSettings}
        fieldComponents={this.fieldComponents}
        items={this.items}
        onUpdateItem={this.handleUpdateItem}
        onChange={this.onChange}
      />
    );
  }

  /** A row list reads as a table when the field asks for one: the names once, in a header. */
  private get isTable(): boolean {
    return this.field?.admin?.layout === 'table' && Array.isArray(this.field?.fields) && this.field.fields.length > 0;
  }

  render(): React.ReactNode {
    const { field, theme } = this;
    const items = this.items;
    const { draggedIndex, isHandleHovered } = this;

    if (this.isTable) {
      return (
        <ArrayFieldTable
          field={field}
          items={items}
          renderField={this.renderField}
          onAdd={this.handleAddItem}
          onRemove={this.handleRemoveItem}
        />
      );
    }

    return (
    <div className="space-y-4">
      {items.map((item, index) => (
         <ArrayFieldRow
            key={index}
            field={field}
            item={item}
            index={index}
            theme={theme}
            itemsLength={items.length}
            draggedIndex={draggedIndex}
            isHandleHovered={isHandleHovered}
            renderField={this.renderField}
            onSetDragged={this.handleSetDragged}
            onSetHandleHovered={this.handleSetHandleHovered}
            onReorder={this.handleReorder}
            onMoveUp={this.handleMoveUp}
            onMoveDown={this.handleMoveDown}
            onRemove={this.handleRemoveItem}
         />
      ))}

      {/* The console's button. It used to be a 126px dashed drop-zone with a boxed plus inside it
          that turned indigo on hover — the tallest thing in a drawer, for "add one more row". */}
      <button type="button" onClick={this.handleAddItem} className="fc-btn">
        <FrameworkIcons.Plus size={15} />
        <span>{AdminI18n.t('ui.array.addNew', { label: field.label || AdminI18n.t('ui.array.item') })}</span>
      </button>
    </div>
    );
  }
}
