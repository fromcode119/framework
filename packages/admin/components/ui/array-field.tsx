"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { ArrayFieldRow } from './array-field-row';
import { ArrayFieldRowRenderer } from './array-field-row-renderer';
import type { ArrayFieldProps, ArrayFieldState } from './array-field.interfaces';

export class ArrayField extends React.Component<ArrayFieldProps, ArrayFieldState> {
  state: ArrayFieldState = { draggedIndex: null, isHandleHovered: null };

  private get items(): any[] {
    return Array.isArray(this.props.value) ? this.props.value : [];
  }

  private handleAddItem = (): void => {
    const newItem: Record<string, any> = {};
    this.props.field.fields.forEach((f: any) => {
      newItem[f.name] = f.defaultValue !== undefined ? f.defaultValue : null;
    });
    this.props.onChange([...this.items, newItem]);
  };

  private handleRemoveItem = (index: number): void => {
    const newItems = [...this.items];
    newItems.splice(index, 1);
    this.props.onChange(newItems);
  };

  private handleReorder = (fromIndex: number, toIndex: number): void => {
    if (fromIndex === toIndex) return;
    const newItems = [...this.items];
    const item = newItems.splice(fromIndex, 1)[0];
    newItems.splice(toIndex, 0, item);
    this.props.onChange(newItems);
  };

  private handleUpdateItem = (index: number, name: string, val: any): void => {
    const newItems = [...this.items];
    const nextItem = { ...newItems[index], [name]: val };
    newItems[index] = nextItem;
    this.props.onChange(newItems);
  };

  private handleMoveUp = (index: number): void => {
    if (index === 0) return;
    this.handleReorder(index, index - 1);
  };

  private handleMoveDown = (index: number): void => {
    if (index === this.items.length - 1) return;
    this.handleReorder(index, index + 1);
  };

  private renderField = (f: any, item: any, index: number): React.ReactNode => {
    return (
      <ArrayFieldRowRenderer
        field={f}
        item={item}
        index={index}
        theme={this.props.theme}
        collectionSlug={this.props.collectionSlug}
        pluginSettings={this.props.pluginSettings}
        fieldComponents={this.props.fieldComponents}
        items={this.items}
        onUpdateItem={this.handleUpdateItem}
        onChange={this.props.onChange}
      />
    );
  };

  render(): React.ReactNode {
    const { field, theme } = this.props;
    const items = this.items;
    const { draggedIndex, isHandleHovered } = this.state;

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
            onSetDragged={(value) => this.setState({ draggedIndex: value })}
            onSetHandleHovered={(value) => this.setState({ isHandleHovered: value })}
            onReorder={this.handleReorder}
            onMoveUp={this.handleMoveUp}
            onMoveDown={this.handleMoveDown}
            onRemove={this.handleRemoveItem}
         />
      ))}

      <button
        onClick={this.handleAddItem}
        className={`w-full py-6 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group ${
          theme === 'dark'
            ? 'border-slate-800 hover:border-indigo-500/50 bg-slate-900/10 hover:bg-indigo-500/5 text-slate-500 hover:text-indigo-400'
            : 'border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
        }`}
      >
        <div className={`p-3 rounded-lg transition-all shadow-sm ${
          theme === 'dark'
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
