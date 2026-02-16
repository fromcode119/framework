"use client";

import React from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { Select } from '@/components/ui/select';

interface FilterBarProps {
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
  columnsMenuRef: React.RefObject<HTMLDivElement>;
  allColumns: any[];
  visibleColumnIds: string[];
  toggleColumn: (id: string) => void;
  selectFilterFields: any[];
  fieldFilters: Record<string, string>;
  setFieldFilters: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  prettifyColumnName: (name: string) => string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
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
  selectFilterFields,
  fieldFilters,
  setFieldFilters,
  prettifyColumnName
}) => {
  return (
    <div className="flex flex-col md:flex-row items-center gap-2 flex-1 w-full min-w-0">
      <div className="flex-1 w-full md:min-w-[200px] relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <FrameworkIcons.Search size={18} />
        </div>
        <input 
          type="text"
          placeholder={`Search ${slug}...`}
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
        <div className="w-full md:w-44 shrink-0">
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
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

      <div className="w-full md:w-auto relative shrink-0" ref={columnsMenuRef}>
        <button
          type="button"
          onClick={() => setShowColumnsMenu((prev) => !prev)}
          className={`w-full md:w-auto h-11 px-4 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 leading-none shadow-sm transition-all shrink-0 ${
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
          <div
            className={`absolute right-0 mt-2 w-72 max-w-[92vw] rounded-2xl border shadow-2xl p-2 z-30 ${
              theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wide text-slate-400">
              Visible Columns
            </div>
            <div className="max-h-64 overflow-auto pr-1">
              {allColumns.map((column) => {
                const checked = visibleColumnIds.includes(column.id);
                return (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => toggleColumn(column.id)}
                    className={`w-full px-2.5 py-2 rounded-lg text-left text-xs font-semibold transition-all flex items-center justify-between ${
                      checked
                        ? theme === 'dark'
                          ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : theme === 'dark'
                          ? 'text-slate-300 hover:bg-slate-800'
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{column.header}</span>
                    <span className={`h-4 w-4 rounded border inline-flex items-center justify-center ${
                      checked
                        ? theme === 'dark'
                          ? 'border-indigo-300/40'
                          : 'border-indigo-300'
                        : theme === 'dark'
                          ? 'border-slate-600'
                          : 'border-slate-300'
                    }`}>
                      {checked && (
                        <FrameworkIcons.Check
                          size={10}
                          className={theme === 'dark' ? 'text-indigo-200' : 'text-indigo-600'}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectFilterFields.length > 0 && (
        <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-2">
          {selectFilterFields.map((field: any) => (
            <div key={field.name} className="w-full md:w-44 shrink-0">
              <Select
                value={fieldFilters[field.name] || 'all'}
                onChange={(value) => {
                  setFieldFilters((prev) => ({ ...prev, [field.name]: value }));
                  setPage(1);
                }}
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
      )}
    </div>
  );
};
