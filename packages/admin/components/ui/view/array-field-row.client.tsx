import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GripVertical } from 'lucide-react';

export class ArrayFieldRow extends PureReactor {
  @prop declare field: any;
  @prop declare item: any;
  @prop declare index: number;
  @prop declare theme?: ThemeMode;
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

  render(): ReactNode {
    const {
      field, item, index, theme, itemsLength, draggedIndex, isHandleHovered,
      renderField, onSetDragged, onSetHandleHovered, onReorder, onMoveUp, onMoveDown, onRemove,
    } = this;

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
          theme === ThemeMode.DARK ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <div
            onMouseEnter={() => onSetHandleHovered(index)}
            onMouseLeave={() => onSetHandleHovered(null)}
            className={`cursor-grab active:cursor-grabbing p-1.5 rounded-lg transition-colors mr-2 ${
              theme === ThemeMode.DARK ? 'text-slate-700 hover:text-indigo-400' : 'text-slate-200 hover:text-indigo-500'
            }`}
          >
            <GripVertical size={16} className="opacity-50" />
          </div>
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className={`p-1 rounded-lg transition-colors ${theme === ThemeMode.DARK ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-white text-slate-400'} disabled:opacity-20`}
          >
            <FrameworkIcons.ChevronUp size={12} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === itemsLength - 1}
            className={`p-1 rounded-lg transition-colors ${theme === ThemeMode.DARK ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-white text-slate-400'} disabled:opacity-20`}
          >
            <FrameworkIcons.ChevronDown size={12} />
          </button>
          <button
            onClick={() => onRemove(index)}
            className="p-1 rounded-lg hover:bg-rose-500 hover:text-white text-rose-500/50 transition-all ml-0.5"
          >
            <FrameworkIcons.Trash size={12} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {visibleFields.map((f: any) => (
            <div key={f.name} className={f.type === 'textarea' || f.type === 'relationship' || f.type === 'array' ? 'md:col-span-2' : ''}>
              <label className={`block text-[11px] font-semibold tracking-wide mb-1.5 ${theme === ThemeMode.DARK ? 'text-slate-500/80' : 'text-slate-400'}`}>
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
