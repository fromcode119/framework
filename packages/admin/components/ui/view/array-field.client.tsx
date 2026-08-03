import { ThemeMode } from '@fromcode119/core/client';
import type React from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { ArrayFieldRow } from '@/components/ui/view/array-field-row.client';
import { ArrayFieldRowRenderer } from '@/components/ui/view/array-field-row-renderer.client';

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

  render(): React.ReactNode {
    const { field, theme } = this;
    const items = this.items;
    const { draggedIndex, isHandleHovered } = this;

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

      <button
        onClick={this.handleAddItem}
        className={`w-full py-6 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group ${
          theme === ThemeMode.DARK
            ? 'border-slate-800 hover:border-indigo-500/50 bg-slate-900/10 hover:bg-indigo-500/5 text-slate-500 hover:text-indigo-400'
            : 'border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
        }`}
      >
        <div className={`p-3 rounded-lg transition-all shadow-sm ${
          theme === ThemeMode.DARK
            ? 'bg-slate-800 group-hover:bg-indigo-500 group-hover:text-white'
            : 'bg-white group-hover:bg-indigo-600 group-hover:text-white shadow-slate-200'
        }`}>
          <FrameworkIcons.Plus size={20} strokeWidth={3} />
        </div>
        <span className="text-[10px] font-semibold tracking-widest">Add New {field.label || 'Item'}</span>
      </button>
    </div>
    );
  }
}
