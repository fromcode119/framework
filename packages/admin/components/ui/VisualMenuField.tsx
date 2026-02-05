"use client";

import React from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { Input } from './Input';
import { Select } from './Select';
import { TagField } from './TagField';

interface VisualMenuFieldProps {
  field: any;
  value: any[];
  onChange: (value: any[]) => void;
  theme?: string;
  collectionSlug: string;
}

/**
 * Visual Menu Builder Component.
 * Supports hierarchical menu structures with visual indentation and easy ordering.
 */
export const VisualMenuField = ({ field, value = [], onChange, theme, collectionSlug }: VisualMenuFieldProps) => {
  const items = Array.isArray(value) ? value : [];

  const handleAddItem = () => {
    const newItem: Record<string, any> = {
      label: 'New Menu Item',
      type: 'url',
      url: '/',
      parent: null,
      depth: 0
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const handleUpdateItem = (index: number, name: string, val: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [name]: val };
    onChange(newItems);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    onChange(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    onChange(newItems);
  };

  const handleIndent = (index: number, direction: 'left' | 'right') => {
    const newItems = [...items];
    const currentDepth = newItems[index].depth || 0;
    
    if (direction === 'right') {
        // Can only indent if the previous item is at least at the same depth
        if (index > 0 && (newItems[index - 1].depth || 0) >= currentDepth) {
            newItems[index] = { ...newItems[index], depth: currentDepth + 1 };
        }
    } else {
        if (currentDepth > 0) {
            newItems[index] = { ...newItems[index], depth: currentDepth - 1 };
        }
    }
    onChange(newItems);
  };

  const renderFieldInput = (f: any, item: any, index: number) => {
    const val = item[f.name];
    const fieldProps = {
      value: val,
      onChange: (v: any) => handleUpdateItem(index, f.name, v),
      theme,
      placeholder: `Enter ${f.label || f.name}...`,
    };

    if (f.type === 'relationship') {
       return (
        <TagField 
          {...fieldProps}
          collectionSlug={collectionSlug}
          fieldName={f.name}
          sourceCollection={f.admin?.sourceCollection || f.relationTo}
          sourceField={f.admin?.sourceField || 'slug'}
          hasMany={false}
          allowCreate={false}
        />
       );
    }

    if (f.type === 'select') {
      return <Select {...fieldProps} options={f.options || []} />;
    }

    return <Input {...fieldProps} type="text" className="font-bold h-10 text-xs" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
         <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-indigo-400' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}>
                <FrameworkIcons.Layout size={16} />
            </div>
            <div>
                <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Visual Structure</span>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Manage hierarchies via indentation</p>
            </div>
         </div>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
            <div 
                key={index} 
                className={`relative group flex gap-4 transition-all duration-300 animate-in fade-in slide-in-from-left-2`}
                style={{ paddingLeft: `${(item.depth || 0) * 32}px` }}
            >
                {/* Visual Branch Line */}
                {(item.depth || 0) > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 flex items-center" style={{ width: `${(item.depth || 0) * 32}px` }}>
                         <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-[2px] rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                         <div className={`absolute left-4 top-0 bottom-1/2 w-[2px] rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} ${index === 0 ? 'hidden' : ''}`} />
                    </div>
                )}

                <div className={`flex-1 p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                    theme === 'dark' 
                        ? 'bg-slate-900/40 border-slate-800 group-hover:border-indigo-500/30' 
                        : 'bg-white border-slate-200 group-hover:border-indigo-500/30 shadow-sm'
                }`}>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {field.fields.filter((f: any) => !f.admin?.condition || f.admin.condition({}, item)).map((f: any) => (
                            <div key={f.name} className={f.name === 'label' ? 'md:col-span-1' : 'md:col-span-1'}>
                                {renderFieldInput(f, item, index)}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleIndent(index, 'left')}
                            disabled={(item.depth || 0) === 0}
                            className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} disabled:opacity-0`}
                        >
                            <FrameworkIcons.Left size={14} />
                        </button>
                        <button 
                            onClick={() => handleIndent(index, 'right')}
                            className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                        >
                            <FrameworkIcons.Right size={14} />
                        </button>
                        <div className={`w-[1px] h-4 mx-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        <button 
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} disabled:opacity-0`}
                        >
                            <FrameworkIcons.ChevronUp size={14} />
                        </button>
                        <button 
                            onClick={() => handleMoveDown(index)}
                            disabled={index === items.length - 1}
                            className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} disabled:opacity-0`}
                        >
                            <FrameworkIcons.ChevronDown size={14} />
                        </button>
                        <button 
                            onClick={() => handleRemoveItem(index)}
                            className="p-2 rounded-xl hover:bg-rose-500 hover:text-white text-rose-500/40 transition-all ml-1"
                        >
                            <FrameworkIcons.Trash size={14} />
                        </button>
                    </div>
                </div>
            </div>
        ))}
      </div>

      <button
        onClick={handleAddItem}
        className={`w-full py-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-all group ${
          theme === 'dark' 
            ? 'border-slate-800 hover:border-indigo-500/50 bg-slate-900/10 hover:bg-indigo-500/5 text-slate-500 hover:text-indigo-400' 
            : 'border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
        }`}
      >
        <FrameworkIcons.Plus size={16} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Initialize Menu Protocol</span>
      </button>
    </div>
  );
};
