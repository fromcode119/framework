"use client";

import React from 'react';
import { Input } from './input';
import { Select } from './select';
import { TagField } from './tag-field';
import type { VisualMenuFieldInputProps } from './visual-menu-field.interfaces';

export class VisualMenuFieldInput extends React.Component<VisualMenuFieldInputProps> {
  render(): React.ReactNode {
    const { field: f, item, index, theme, collectionSlug, onUpdateItem } = this.props;
    let val = item[f.name];

    // Safety check: if we have an object where a string is expected (e.g. relationship field stored as object)
    if (val && typeof val === 'object' && !Array.isArray(val)) {
       val = val.value || val.slug || val.id || val.label || '';
    }

    const fieldProps = {
      value: val,
      onChange: (v: any) => {
        const value = v?.target ? v.target.value : v;
        onUpdateItem(index, f.name, value);
      },
      theme,
      placeholder: `Enter ${f.label || f.name}...`,
    };

    if (f.type === 'relationship') {
       return (
        <div className="flex flex-col gap-0.5">
          {f.label && <label className="text-[9px] font-semibold text-slate-400 tracking-wide">{f.label}</label>}
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
          {f.label && <label className="text-[9px] font-semibold text-slate-400 tracking-wide">{f.label}</label>}
          <Select {...fieldProps} options={f.options || []} />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0.5">
        {f.label && <label className="text-[9px] font-semibold text-slate-400 tracking-wide">{f.label}</label>}
        <Input {...fieldProps} type="text" inputClassName="font-semibold h-8 text-xs" />
      </div>
    );
  }
}
