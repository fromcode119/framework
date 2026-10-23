import { Fragment } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { CollectionListCard } from '@/components/collection/list/view/collection-list-card.client';
import { DataTablePagination } from '@/components/ui/view/data-table-pagination.client';
import { DataTableSection } from '@/components/ui/data-table-section';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The list below desktop width. A table of six or more columns cannot be read on a phone — it either
 * scrolls sideways or wraps every cell into a column of single words — so each record becomes a card.
 */
export class CollectionListCards extends PureReactor {
  declare props: Pick<CollectionListCards, 'data' | 'layout' | 'cells' | 'loading' | 'emptyMessage' | 'total' | 'page' | 'pageSize' | 'onPageChange' | 'onOpen' | 'renderActions' | 'renderExpanded' | 'selectedIds' | 'onSelectionChange' | 'sections' | 'sectionClassName' | 'renderHandle' | 'rowClassName'>;

  @prop declare data: any[];
  @prop declare layout: CollectionListLayout;
  @prop declare cells: ReadonlyMap<string, (row: any) => ReactNode>;
  @prop declare loading: boolean;
  @prop declare emptyMessage?: string;
  @prop declare total: number;
  @prop declare page: number;
  @prop declare pageSize: number;
  @prop declare onPageChange: (page: number) => void;
  @prop declare onOpen: (row: any) => void;
  @prop declare renderActions: (row: any) => ReactNode;
  /** The quick edit form for a record, or null when it is closed. */
  @prop declare renderExpanded: (row: any) => ReactNode;
  @prop declare selectedIds: string[];
  @prop declare onSelectionChange: Dispatch<SetStateAction<string[]>>;
  /** In a grouped list, the records split into headed sections (shown in place of `data`). */
  @prop declare sections?: readonly DataTableSection<any>[];
  @prop declare sectionClassName?: (section: DataTableSection<any>) => string;
  /** The grip a record is dragged by, in a list with an order field. */
  @prop declare renderHandle?: (row: any) => ReactNode;
  @prop declare rowClassName?: (row: any) => string;

  @bound private toggle(id: string): void {
    // From the latest selection, not this render's: two quick taps would otherwise both start from the
    // same list and the second would undo the first.
    this.onSelectionChange((previous) => (previous.includes(id) ? previous.filter((existing) => existing !== id) : [...previous, id]));
  }

  private renderEmpty(): ReactNode {
    return (
      <div className="px-6 py-16 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:border-transparent">
          <FrameworkIcons.Search size={20} className="text-slate-400" />
        </div>
        <p className="font-semibold text-slate-400 text-[12px]">{this.emptyMessage || AdminI18n.t('ui.table.empty')}</p>
      </div>
    );
  }

  private renderCard(row: any): ReactNode {
    return (
      <CollectionListCard
        key={String(row.id)}
        row={row}
        layout={this.layout}
        cells={this.cells}
        actions={this.renderActions(row)}
        expanded={this.renderExpanded(row)}
        onOpen={this.onOpen}
        selected={(this.selectedIds || []).includes(String(row.id))}
        onToggle={this.toggle}
        handle={this.renderHandle?.(row)}
        className={this.rowClassName?.(row)}
      />
    );
  }

  private renderSections(sections: readonly DataTableSection<any>[]): ReactNode {
    return sections.map((section) => (
      <Fragment key={section.id}>
        <div data-row-id={section.id} className={`px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-y border-slate-200/60 dark:border-slate-800 first:border-t-0 ${this.sectionClassName?.(section) || ''}`}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{section.label}</span>
          <span className="ml-2 text-[11px] font-semibold text-slate-400">{section.rows.length}</span>
        </div>
        {section.rows.map((row) => this.renderCard(row))}
      </Fragment>
    ));
  }

  render(): ReactNode {
    const rows = this.data || [];
    const sections = this.sections;
    const empty = sections ? !sections.length : rows.length === 0;
    return (
      <div className={`transition-opacity ${this.loading ? 'opacity-60 pointer-events-none' : ''}`}>
        {empty && !this.loading ? this.renderEmpty() : sections ? this.renderSections(sections) : rows.map((row) => this.renderCard(row))}
        <DataTablePagination totalDocs={this.total} limit={this.pageSize} page={this.page} onPageChange={this.onPageChange} />
      </div>
    );
  }
}
