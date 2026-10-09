import { ReorderDirection } from '@/components/collection/list/enums/reorder-direction.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound, Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { CollectionColumnsMenu } from '@/components/collection/list/view/columns-menu.client';
import { FilterPanel } from '@/components/collection/list/view/filter-panel.client';
import { FilterChips } from '@/components/collection/list/view/filter-chips.client';
import { SortMenu } from '@/components/collection/list/view/sort-menu.client';
import { ListFilter } from '@/components/collection/list/list-filter';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Search, then one Filters button instead of a dropdown per filter, then Columns and Sort. The filters
 * in force sit underneath as chips. A collection with eight select fields used to spend three rows of
 * the screen on dropdowns before the first record — on a phone, most of the first screen.
 */
export class FilterBar extends PureReactor {
  @prop declare collection?: any;
  @prop declare slug: string;
  @prop declare theme: ThemeMode;
  @prop declare total: number;
  @prop declare search: string;
  @prop declare setSearch: (val: string) => void;
  @prop declare sort: string;
  @prop declare onSort: (sort: string) => void;
  @prop declare statusFilter: string;
  @prop declare setStatusFilter: (val: string) => void;
  @prop declare statusOptions: { label: string; value: string }[];
  @prop declare setPage: (val: number) => void;
  @prop declare archivable?: boolean;
  @prop declare showArchived?: boolean;
  @prop declare setShowArchived?: (val: boolean) => void;
  @prop declare showColumnsMenu: boolean;
  @prop declare setShowColumnsMenu: (val: boolean | ((prev: boolean) => boolean)) => void;
  @prop declare columnsMenuRef: Ref<HTMLDivElement>;
  @prop declare allColumns: any[];
  @prop declare visibleColumnIds: string[];
  @prop declare toggleColumn: (id: string) => void;
  @prop declare reorderColumn: (id: string, direction: ReorderDirection) => void;
  @prop declare stickyColumnIds: string[];
  @prop declare toggleStickyColumn: (id: string) => void;
  @prop declare selectFilterFields: any[];
  @prop declare fieldFilters: Record<string, string>;
  @prop declare setFieldFilters: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  @prop declare prettifyColumnName: (name: string) => string;

  @state filtersOpen = false;

  /** Every filter this collection offers, in the order the panel lists them. */
  private get filters(): ListFilter[] {
    const all = AdminI18n.t('collection.list.filterAll');
    const filters: ListFilter[] = [];
    if (this.statusOptions.length) {
      filters.push(new ListFilter('status', AdminI18n.t('collection.list.filterStatus'),
        [{ label: all, value: 'all' }, ...this.statusOptions.map((option) => ({ label: option.label || option.value, value: option.value }))],
        this.statusFilter, 'all', (value) => { this.setStatusFilter(value); this.setPage(1); }));
    }
    for (const field of this.selectFilterFields) {
      const options = (field.options || []).map((option: any) => ({ label: String(option?.label || option?.value || ''), value: String(option?.value || '') }));
      filters.push(new ListFilter(field.name, field.label || this.prettifyColumnName(field.name), [{ label: all, value: 'all' }, ...options],
        this.fieldFilters[field.name] || 'all', 'all', (value) => {
          this.setFieldFilters((prev) => ({ ...prev, [field.name]: value }));
          this.setPage(1);
        }));
    }
    if (this.archivable) {
      filters.push(new ListFilter('archived', AdminI18n.t('collection.list.filterShow'),
        [{ label: AdminI18n.t('collection.list.viewActive'), value: 'active' }, { label: AdminI18n.t('collection.list.viewArchived'), value: 'archived' }],
        this.showArchived ? 'archived' : 'active', 'active', (value) => this.setShowArchived?.(value === 'archived')));
    }
    return filters;
  }

  @bound private toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  @bound private closeFilters(): void {
    this.filtersOpen = false;
  }

  @bound private toggleColumnsMenu(): void {
    this.setShowColumnsMenu((prev) => !prev);
  }

  private renderFiltersButton(filters: ListFilter[]): ReactNode {
    const activeCount = filters.filter((filter) => filter.isActive).length;
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={this.toggleFilters}
          aria-expanded={this.filtersOpen}
          title={AdminI18n.t('collection.list.filters')}
          className={`h-11 px-3.5 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 leading-none shadow-sm transition-all ${
            this.filtersOpen || activeCount
              ? 'bg-white border-indigo-400 text-slate-800 dark:bg-slate-900 dark:border-indigo-500/60 dark:text-slate-100'
              : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/60'
          }`}
        >
          <FrameworkIcons.Filter size={15} />
          <span className="hidden sm:inline">{AdminI18n.t('collection.list.filters')}</span>
          {activeCount ? <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] inline-flex items-center justify-center">{activeCount}</span> : null}
        </button>
        {this.filtersOpen ? <FilterPanel filters={filters} total={this.total} onClose={this.closeFilters} /> : null}
      </div>
    );
  }

  private renderColumnsButton(): ReactNode {
    return (
      <div className="fc-list-table-only relative shrink-0" ref={this.columnsMenuRef}>
        <button
          type="button"
          onClick={this.toggleColumnsMenu}
          title={AdminI18n.t('collection.list.columns')}
          className="h-11 px-3.5 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 leading-none shadow-sm transition-all bg-white border-slate-200 text-slate-700 hover:border-indigo-400 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/60"
        >
          <FrameworkIcons.Layout size={15} />
          <span className="hidden lg:inline">{AdminI18n.t('collection.list.columns')}</span>
        </button>
        {this.showColumnsMenu && (
          <CollectionColumnsMenu
            theme={this.theme}
            allColumns={this.allColumns}
            visibleColumnIds={this.visibleColumnIds}
            toggleColumn={this.toggleColumn}
            reorderColumn={this.reorderColumn}
            stickyColumnIds={this.stickyColumnIds}
            toggleStickyColumn={this.toggleStickyColumn}
          />
        )}
      </div>
    );
  }

  render(): ReactNode {
    const filters = this.filters;
    return (
      <div className="flex flex-col gap-3 flex-1 w-full min-w-0">
        <div className="flex items-center gap-2 w-full min-w-0">
          <div className="relative group flex-1 min-w-0">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <FrameworkIcons.Search size={18} />
            </div>
            <input
              type="text"
              placeholder={CollectionListUtils.resolveCollectionSearchPlaceholder(this.collection, this.slug)}
              value={this.search}
              onChange={(e) => this.setSearch(e.target.value)}
              className={`w-full h-11 pl-12 pr-4 rounded-xl border transition-all text-sm font-semibold outline-none text-ellipsis ${
                this.theme === ThemeMode.DARK
                  ? 'bg-slate-900/50 border-slate-800 focus:border-indigo-500/50 focus:bg-slate-900 text-white shadow-2xl shadow-black/40'
                  : 'bg-white border-slate-200 focus:border-indigo-500 shadow-xl shadow-slate-200/50 text-slate-900'
              }`}
            />
          </div>
          {filters.length ? this.renderFiltersButton(filters) : null}
          {this.renderColumnsButton()}
          <SortMenu columns={this.allColumns} sort={this.sort} onSort={this.onSort} />
        </div>
        <FilterChips filters={filters} />
      </div>
    );
  }
}
