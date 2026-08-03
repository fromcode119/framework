import { ReorderDirection } from '@/components/collection/list/enums/reorder-direction.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '@/components/ui/view/select.client';
import { CollectionColumnsMenu } from '@/components/collection/list/view/columns-menu.client';
import { CollectionListUtils } from '@/components/collection/list/utils';

export class FilterBar extends PureReactor {
  @prop declare collection?: any;
  @prop declare slug: string;
  @prop declare theme: ThemeMode;
  @prop declare search: string;
  @prop declare setSearch: (val: string) => void;
  @prop declare statusFilter: string;
  @prop declare setStatusFilter: (val: string) => void;
  @prop declare statusOptions: { label: string; value: string }[];
  @prop declare setPage: (val: number) => void;
  @prop declare showColumnsMenu: boolean;
  @prop declare setShowColumnsMenu: (val: boolean | ((prev: boolean) => boolean)) => void;
  @prop declare columnsMenuRef: Ref<HTMLDivElement>;
  @prop declare allColumns: any[];
  @prop declare visibleColumnIds: string[];
  @prop declare toggleColumn: (id: string) => void;
  @prop declare reorderColumn: (id: string, direction: ReorderDirection) => void;
  @prop declare selectFilterFields: any[];
  @prop declare fieldFilters: Record<string, string>;
  @prop declare setFieldFilters: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  @prop declare prettifyColumnName: (name: string) => string;

  render(): ReactNode {
  return (
    <div className="flex flex-wrap items-start gap-2 flex-1 w-full min-w-0">
      <div className="relative group min-w-[220px] flex-[1_1_320px] w-full">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
          <FrameworkIcons.Search size={18} />
        </div>
        <input
          type="text"
          placeholder={CollectionListUtils.resolveCollectionSearchPlaceholder(this.collection, this.slug)}
          value={this.search}
          onChange={(e) => this.setSearch(e.target.value)}
          className={`w-full h-11 pl-12 pr-4 rounded-xl border transition-all text-sm font-semibold outline-none ${
            this.theme === ThemeMode.DARK
              ? 'bg-slate-900/50 border-slate-800 focus:border-indigo-500/50 focus:bg-slate-900 text-white shadow-2xl shadow-black/40'
              : 'bg-white border-slate-200 focus:border-indigo-500 shadow-xl shadow-slate-200/50 text-slate-900'
          }`}
        />
      </div>

      {this.statusOptions.length > 0 && (
        <div className="w-full sm:w-44 shrink-0">
          <Select
            value={this.statusFilter}
            onChange={(value) => {
              this.setStatusFilter(value);
              this.setPage(1);
            }}
            theme={this.theme}
            searchable={false}
            size={FieldSize.MD}
            className="w-full"
            triggerClassName="h-11 rounded-xl px-4 text-sm font-semibold"
            options={[
              { label: 'All Statuses', value: 'all' },
              ...this.statusOptions.map((option) => ({
                label: option.label || option.value,
                value: option.value
              }))
            ]}
          />
        </div>
      )}

      <div className="w-full sm:w-auto relative shrink-0" ref={this.columnsMenuRef}>
        <button
          type="button"
          onClick={() => this.setShowColumnsMenu((prev) => !prev)}
          className={`w-full sm:w-auto h-11 px-4 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 leading-none shadow-sm transition-all shrink-0 ${
            this.theme === ThemeMode.DARK
              ? 'bg-slate-900/60 border-slate-800 text-slate-200 hover:border-indigo-500/60'
              : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400'
          }`}
        >
          <FrameworkIcons.Layout size={14} />
          <span className="hidden lg:inline">Columns</span>
          <FrameworkIcons.Down size={13} className={`${this.showColumnsMenu ? 'rotate-180' : ''} transition-transform`} />
        </button>

        {this.showColumnsMenu && (
          <CollectionColumnsMenu
            theme={this.theme}
            allColumns={this.allColumns}
            visibleColumnIds={this.visibleColumnIds}
            toggleColumn={this.toggleColumn}
            reorderColumn={this.reorderColumn}
          />
        )}
      </div>

      {this.selectFilterFields.map((field: any) => (
        <div key={field.name} className="w-full sm:w-44 shrink-0">
          <Select
            value={this.fieldFilters[field.name] || 'all'}
            onChange={(value) => {
              this.setFieldFilters((prev) => ({ ...prev, [field.name]: value }));
              this.setPage(1);
            }}
            theme={this.theme}
            searchable={false}
            size={FieldSize.MD}
            className="w-full"
            triggerClassName="h-11 rounded-xl px-4 text-sm font-semibold"
            options={[
              { label: `All ${field.label || this.prettifyColumnName(field.name)}`, value: 'all' },
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
