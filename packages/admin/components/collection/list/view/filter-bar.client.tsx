import { ReorderDirection } from '@/components/collection/list/enums/reorder-direction.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { CollectionColumnsMenu } from '@/components/collection/list/view/columns-menu.client';
import { ListToolbar } from '@/components/ui/list-toolbar/view/list-toolbar.client';
import { SortMenu } from '@/components/collection/list/view/sort-menu.client';
import { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A collection's list toolbar: the shared search, Filters button and chips (`ListToolbar`), plus
 * Columns and Sort. A collection with eight select fields used to spend three rows of the screen on
 * dropdowns before the first record — on a phone, most of the first screen.
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

  @bound private toggleColumnsMenu(): void {
    this.setShowColumnsMenu((prev) => !prev);
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
    return (
      <ListToolbar
        search={this.search}
        onSearch={this.setSearch}
        placeholder={CollectionListUtils.resolveCollectionSearchPlaceholder(this.collection, this.slug)}
        theme={this.theme}
        filters={this.filters}
        total={this.total}
      >
        {this.renderColumnsButton()}
        <SortMenu columns={this.allColumns} sort={this.sort} onSort={this.onSort} />
      </ListToolbar>
    );
  }
}
