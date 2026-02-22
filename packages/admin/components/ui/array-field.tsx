"use client";

import React from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { GripVertical } from 'lucide-react';
import { Card } from './card';
import { Input } from './input';
import { Select } from './select';
import { TagField } from './tag-field';
import { RelationshipSelectLocal } from '../collection/relationship-select-local';

interface ArrayFieldProps {
  field: any;
  value: any[];
  onChange: (value: any[]) => void;
  theme?: string;
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
}

export const ArrayField = ({ field, value = [], onChange, theme, collectionSlug, pluginSettings }: ArrayFieldProps) => {
  const items = Array.isArray(value) ? value : [];
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [isHandleHovered, setIsHandleHovered] = React.useState<number | null>(null);

  const handleAddItem = () => {
    const newItem: Record<string, any> = {};
    field.fields.forEach((f: any) => {
      newItem[f.name] = f.defaultValue !== undefined ? f.defaultValue : null;
    });
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newItems = [...items];
    const item = newItems.splice(fromIndex, 1)[0];
    newItems.splice(toIndex, 0, item);
    onChange(newItems);
  };

  const handleUpdateItem = (index: number, name: string, val: any) => {
    const newItems = [...items];
    const nextItem = { ...newItems[index], [name]: val };

    newItems[index] = nextItem;
    onChange(newItems);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    handleReorder(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    handleReorder(index, index + 1);
  };

  const renderField = (f: any, item: any, index: number) => {
    const val = item[f.name];
    const fieldProps = {
      value: val,
      onChange: (v: any) => {
        const value = v?.target ? v.target.value : v;
        handleUpdateItem(index, f.name, value);
      },
      theme,
      placeholder: `Enter ${f.label || f.name}...`,
    };

    const isTagComponent =
      f.admin?.component === './tag-field' ||
      f.admin?.component === 'TagField' ||
      f.admin?.component === 'Tags';
    const hasMany = f.hasMany !== undefined ? f.hasMany : isTagComponent;

    if (f.type === 'relationship' && !hasMany) {
      return (
        <RelationshipSelectLocal
          field={f}
          value={val}
          onChange={(next) => handleUpdateItem(index, f.name, next)}
          theme={theme || 'light'}
        />
      );
    }

    if (f.type === 'relationship' || isTagComponent) {
       return (
        <TagField 
          {...fieldProps}
          collectionSlug={collectionSlug}
          fieldName={f.name}
          sourceCollection={f.admin?.sourceCollection || f.relationTo}
          sourceField={f.admin?.sourceField || (f.admin?.sourceCollection === 'users' ? 'username' : 'slug')}
          hasMany={hasMany}
          allowCreate={f.admin?.sourceCollection !== 'users'}
        />
       );
    }

    if (f.type === 'select') {
      return <Select {...fieldProps} options={f.options || []} size="sm" />;
    }

    if (f.type === 'boolean' || f.type === 'checkbox') {
        return (
            <Select 
                {...fieldProps} 
                value={val?.toString() || 'false'}
                options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
                onChange={(v) => handleUpdateItem(index, f.name, v === 'true')}
                size="sm"
            />
        );
    }

    return (
      <Input
        {...fieldProps}
        type={f.type === 'number' ? 'number' : 'text'}
        size="sm"
      />
    );
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
         // Check conditions
         const visibleFields = field.fields.filter((f: any) => {
            if (!f.admin?.condition) return true;
            return f.admin.condition({}, item); // Passing empty global data for now as it's harder to get here
         });

         return (
            <div 
              key={index} 
              draggable={isHandleHovered === index || draggedIndex === index}
              onDragStart={(e) => {
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedIndex === null || draggedIndex === index) return;
                handleReorder(draggedIndex, index);
                setDraggedIndex(index);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setIsHandleHovered(null);
              }}
              className={`relative p-5 rounded-lg border transition-all duration-300 ${
                draggedIndex === index ? 'opacity-20 scale-[0.98]' : ''
              } ${
                theme === 'dark' ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <div 
                  onMouseEnter={() => setIsHandleHovered(index)}
                  onMouseLeave={() => setIsHandleHovered(null)}
                  className={`cursor-grab active:cursor-grabbing p-1.5 rounded-md transition-colors mr-2 ${
                    theme === 'dark' ? 'text-slate-700 hover:text-indigo-400' : 'text-slate-200 hover:text-indigo-500'
                  }`}
                >
                  <GripVertical size={16} className="opacity-50" />
                </div>
                <button 
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-white text-slate-400'} disabled:opacity-20`}
                >
                  <FrameworkIcons.ChevronUp size={12} />
                </button>
                <button 
                  onClick={() => handleMoveDown(index)}
                  disabled={index === items.length - 1}
                  className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-white text-slate-400'} disabled:opacity-20`}
                >
                  <FrameworkIcons.ChevronDown size={12} />
                </button>
                <button 
                  onClick={() => handleRemoveItem(index)}
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
      })}

      <button
        onClick={handleAddItem}
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
};
