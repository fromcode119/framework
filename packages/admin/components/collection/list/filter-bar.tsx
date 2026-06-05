"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '@/components/ui/select';
import { CollectionColumnsMenu } from './columns-menu';
import { CollectionListUtils } from './utils';

interface FilterBarProps {
  collection?: any;
  slug: string;
  theme: string;
  search: string;
  setSearch: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  statusOptions: { label: string; value: string }[];
  setPage: (val: number) => void;
  showColumnsMenu: boolean;
  setShowColumnsMenu: (val: boolean | ((prev: boolean) => boolean)) => void;
  columnsMenuRef: React.RefObject<HTMLDivElement | null>;
  allColumns: any[];
  visibleColumnIds: string[];
  toggleColumn: (id: string) => void;
  reorderColumn: (id: string, direction: 'up' | 'down') => void;
  selectFilterFields: any[];
  fieldFilters: Record<string, string>;
  setFieldFilters: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  prettifyColumnName: (name: string) => string;
}

export class FilterBar extends React.Component<FilterBarProps> {
  render(): React.ReactNode {
    const {
  collection,
  slug,
  theme,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  statusOptions,
  setPage,
  showColumnsMenu,
  setShowColumnsMenu,
  columnsMenuRef,
  allColumns,
  visibleColumnIds,
  toggleColumn,
  reorderColumn,
  selectFilterFields,
  fieldFilters,
  setFieldFilters,
  prettifyColumnName
} = this.props;
  return (
    <div className="flex flex-wrap items-start gap-2 flex-1 w-full min-w-0">
      <div className="relative group min-w-[220px] flex-[1_1_320px] w-full">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <FrameworkIcons.Search size={18} />
        </div>
        <input 
          type="text"
          placeholder={CollectionListUtils.resolveCollectionSearchPlaceholder(collection, slug)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full h-11 pl-12 pr-4 rounded-xl border transition-all text-sm font-semibold outline-none ${
            theme === 'dark' 
              ? 'bg-slate-900/50 border-slate-800 focus:border-indigo-500/50 focus:bg-slate-900 text-white shadow-2xl shadow-black/40' 
              : 'bg-white border-slate-200 focus:border-indigo-500 shadow-xl shadow-slate-200/50 text-slate-900'
          }`}
        />
      </div>

      {statusOptions.length > 0 && (
        <div className="w-full sm:w-44 shrink-0">
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            theme={theme}
            searchable={false}
            size="md"
            className="w-full"
            triggerClassName="h-11 rounded-xl px-4 text-sm font-semibold"
            options={[
              { label: 'All Statuses', value: 'all' },
              ...statusOptions.map((option) => ({
                label: option.label || option.value,
                value: option.value
              }))
            ]}
          />
        </div>
      )}

      <div className="w-full sm:w-auto relative shrink-0" ref={columnsMenuRef}>
        <button
          type="button"
          onClick={() => setShowColumnsMenu((prev) => !prev)}
          className={`w-full sm:w-auto h-11 px-4 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 leading-none shadow-sm transition-all shrink-0 ${
            theme === 'dark'
              ? 'bg-slate-900/60 border-slate-800 text-slate-200 hover:border-indigo-500/60'
              : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400'
          }`}
        >
          <FrameworkIcons.Layout size={14} />
          <span className="hidden lg:inline">Columns</span>
          <FrameworkIcons.Down size={13} className={`${showColumnsMenu ? 'rotate-180' : ''} transition-transform`} />
        </button>

        {showColumnsMenu && (
          <CollectionColumnsMenu
            theme={theme}
            allColumns={allColumns}
            visibleColumnIds={visibleColumnIds}
            toggleColumn={toggleColumn}
            reorderColumn={reorderColumn}
          />
        )}
      </div>

      {selectFilterFields.map((field: any) => (
        <div key={field.name} className="w-full sm:w-44 shrink-0">
          <Select
            value={fieldFilters[field.name] || 'all'}
            onChange={(value) => {
              setFieldFilters((prev) => ({ ...prev, [field.name]: value }));
              setPage(1);
            }}
            theme={theme}
            searchable={false}
            size="md"
            className="w-full"
            triggerClassName="h-11 rounded-xl px-4 text-sm font-semibold"
            options={[
              { label: `All ${field.label || prettifyColumnName(field.name)}`, value: 'all' },
              ...(field.options || []).map((option: any) => ({
                label: String(option?.label || option?.value || ''),
                value: String(option?.value || '')
              }))
            ]}
          />
        </div>
      ))}
    </div>
  );
  }
}
