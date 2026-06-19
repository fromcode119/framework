"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GripVertical } from 'lucide-react';
import type { ArrayFieldRowProps } from './array-field.interfaces';

export class ArrayFieldRow extends React.Component<ArrayFieldRowProps> {
  render(): React.ReactNode {
    const {
      field, item, index, theme, itemsLength, draggedIndex, isHandleHovered,
      renderField, onSetDragged, onSetHandleHovered, onReorder, onMoveUp, onMoveDown, onRemove,
    } = this.props;

    const visibleFields = field.fields.filter((f: any) => {
      if (!f.admin?.condition) return true;
      return f.admin.condition({}, item); // Passing empty global data for now as it's harder to get here
    });

    return (
      <div
        draggable={isHandleHovered === index || draggedIndex === index}
        onDragStart={(e) => {
          onSetDragged(index);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedIndex === null || draggedIndex === index) return;
          onReorder(draggedIndex, index);
          onSetDragged(index);
        }}
        onDragEnd={() => {
          onSetDragged(null);
          onSetHandleHovered(null);
        }}
        className={`relative p-5 rounded-lg border transition-all duration-300 ${
          draggedIndex === index ? 'opacity-20 scale-[0.98]' : ''
        } ${
          theme === 'dark' ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <div
            onMouseEnter={() => onSetHandleHovered(index)}
            onMouseLeave={() => onSetHandleHovered(null)}
            className={`cursor-grab active:cursor-grabbing p-1.5 rounded-md transition-colors mr-2 ${
              theme === 'dark' ? 'text-slate-700 hover:text-indigo-400' : 'text-slate-200 hover:text-indigo-500'
            }`}
          >
            <GripVertical size={16} className="opacity-50" />
          </div>
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-white text-slate-400'} disabled:opacity-20`}
          >
            <FrameworkIcons.ChevronUp size={12} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === itemsLength - 1}
            className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-white text-slate-400'} disabled:opacity-20`}
          >
            <FrameworkIcons.ChevronDown size={12} />
          </button>
          <button
            onClick={() => onRemove(index)}
            className="p-1 rounded-md hover:bg-rose-500 hover:text-white text-rose-500/50 transition-all ml-0.5"
          >
            <FrameworkIcons.Trash size={12} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {visibleFields.map((f: any) => (
            <div key={f.name} className={f.type === 'textarea' || f.type === 'relationship' || f.type === 'array' ? 'md:col-span-2' : ''}>
              <label className={`block text-[11px] font-semibold tracking-wide mb-1.5 ${theme === 'dark' ? 'text-slate-500/80' : 'text-slate-400'}`}>
                {f.label || f.name}
              </label>
              {renderField(f, item, index)}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
