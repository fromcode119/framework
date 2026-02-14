"use client";

import React from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { Input } from './input';
import { Select } from './select';
import { TagField } from './tag-field';

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
    let val = item[f.name];
    
    // Safety check: if we have an object where a string is expected (e.g. relationship field stored as object)
    if (val && typeof val === 'object' && !Array.isArray(val)) {
       val = val.value || val.slug || val.id || val.label || '';
    }

    const fieldProps = {
      value: val,
      onChange: (v: any) => {
        const value = v?.target ? v.target.value : v;
        handleUpdateItem(index, f.name, value);
      },
      theme,
      placeholder: `Enter ${f.label || f.name}...`,
    };

    if (f.type === 'relationship') {
       return (
        <div className="flex flex-col gap-0.5">
          {f.label && <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{f.label}</label>}
          <TagField 
            {...fieldProps}
            collectionSlug={collectionSlug}
            fieldName={f.name}
            sourceCollection={f.admin?.sourceCollection || f.relationTo}
            sourceField={f.admin?.sourceField || 'slug'}
            hasMany={false}
            allowCreate={false}
          />
        </div>
       );
    }

    if (f.type === 'select') {
      return (
        <div className="flex flex-col gap-0.5">
          {f.label && <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{f.label}</label>}
          <Select {...fieldProps} options={f.options || []} />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0.5">
        {f.label && <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{f.label}</label>}
        <Input {...fieldProps} type="text" inputClassName="font-bold h-8 text-xs" />
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
         <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-indigo-400' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}>
                <FrameworkIcons.Layout size={14} />
            </div>
            <div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Menu Structure</span>
            </div>
         </div>
      </div>

      <div className="space-y-1.5">
        {items.map((item, index) => (
            <div 
                key={index} 
                className={`relative group flex gap-3 transition-all duration-300 animate-in fade-in slide-in-from-left-2`}
                style={{ paddingLeft: `${(item.depth || 0) * 24}px` }}
            >
                {/* Visual Branch Line */}
                {(item.depth || 0) > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 flex items-center" style={{ width: `${(item.depth || 0) * 24}px` }}>
                         <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-3 h-[1px] rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                         <div className={`absolute left-3 top-0 bottom-1/2 w-[1px] rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'} ${index === 0 ? 'hidden' : ''}`} />
                    </div>
                )}

                <div className={`flex-1 p-2 rounded-xl border flex items-center gap-2 transition-all ${
                    theme === 'dark' 
                        ? 'bg-slate-900/40 border-slate-800 group-hover:border-indigo-500/30' 
                        : 'bg-white border-slate-200 group-hover:border-indigo-500/30 shadow-sm'
                }`}>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-2">
                        {field.fields.filter((f: any) => !f.admin?.condition || f.admin.condition({}, item)).map((f: any) => (
                            <div key={f.name} className={f.name === 'label' ? 'md:col-span-2' : 'md:col-span-1'}>
                                {renderFieldInput(f, item, index)}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleIndent(index, 'left')}
                            disabled={(item.depth || 0) === 0}
                            className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} disabled:opacity-0`}
                        >
                            <FrameworkIcons.Left size={12} />
                        </button>
                        <button 
                            onClick={() => handleIndent(index, 'right')}
                            className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                        >
                            <FrameworkIcons.Right size={12} />
                        </button>
                        <div className={`w-[1px] h-3 mx-0.5 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
                        <button 
                            onClick={() => handleRemoveItem(index)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-rose-500/40 transition-all ml-0.5"
                        >
                            <FrameworkIcons.Trash size={12} />
                        </button>
                    </div>
                </div>
            </div>
        ))}
      </div>

      <button
        onClick={handleAddItem}
        className={`w-full py-2.5 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all group ${
          theme === 'dark' 
            ? 'border-slate-800 hover:border-indigo-500/40 bg-slate-900/5 hover:bg-indigo-500/5 text-slate-600 hover:text-indigo-400' 
            : 'border-slate-100 hover:border-indigo-200 bg-slate-50/30 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500'
        }`}
      >
        <FrameworkIcons.Plus size={14} />
        <span className="text-[9px] font-bold uppercase tracking-widest">Add Menu Item</span>
      </button>
    </div>
  );
};
