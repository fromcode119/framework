import type { CollectionAccess } from '@/lib/collection-access';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';

import { CollectionQuickEditCard } from '@/components/collection/view/collection-quick-edit-card.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { CollectionListRowActions } from '@/components/collection/list/view/row-actions.client';
import { CollectionListCards } from '@/components/collection/list/view/collection-list-cards.client';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { QuickEditField } from '@/components/collection/list/quick-edit-field';

/**
 * The records: a table where the list is wide enough, a card per record where it is not (the switch
 * is a container query on `.fc-collection-list`, see admin.css). Both share the row actions and the
 * quick edit form, so a record is changed the same way on either.
 */
export class CollectionListTable extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare slotSlug: string;
  @prop declare resolvedSlug: string;
  @prop declare theme: ThemeMode;
  @prop declare total: number;
  @prop declare page: number;
  @prop declare pageSize: number;
  @prop declare search: string;
  @prop declare columns: any[];
  @prop declare layout: CollectionListLayout;
  @prop declare cardCells: ReadonlyMap<string, (row: any) => ReactNode>;
  @prop declare stickyColumnIds: string[];
  @prop declare data: any[];
  @prop declare loading: boolean;
  /** Non-empty when the fetch failed — shown instead of the "no records" empty state. */
  @prop declare loadError: string;
  @prop declare sort: string;
  @prop declare onPageChange: (page: number) => void;
  @prop declare onSort: (sort: string) => void;
  @prop declare onRowClick: (row: any) => void;
  @prop declare onNavigate: (href: string) => void;
  @prop declare selectedIds: string[];
  @prop declare setSelectedIds: Dispatch<SetStateAction<string[]>>;
  @prop declare quickEditExpandedId: string | null;
  @prop declare quickEditLoadingId: string | null;
  @prop declare quickEditSavingId: string | null;
  @prop declare quickEditData: Record<string, any>;
  @prop declare setQuickEditData: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare quickEditStatus: { type: NotificationType; message: string } | null;
  @prop declare quickEditFields: readonly QuickEditField[];
  @prop declare pluginSettings: Record<string, any>;
  @prop declare frontendUrl: string;
  @prop declare permalinkStructure?: string;
  /** What the signed-in user may do to these records. */
  @prop declare access: CollectionAccess;
  @prop declare onDelete: (id: string) => void;
  /** Archive / Restore one row; absent when the collection is not archivable. */
  @prop declare onArchive?: (id: string, archiving: boolean) => void;
  @prop declare onQuickEditOpen: (row: any, event: MouseEvent) => void;
  @prop declare onQuickEditSave: () => void;
  @prop declare onQuickEditClose: () => void;

  private actionsFor(row: any, compact: boolean): ReactNode {
    return (
      <CollectionListRowActions
        row={row}
        collection={this.collection}
        pluginSlug={this.pluginSlug}
        slug={this.slug}
        slotSlug={this.slotSlug}
        resolvedSlug={this.resolvedSlug}
        theme={this.theme}
        frontendUrl={this.frontendUrl}
        permalinkStructure={this.permalinkStructure}
        pluginSettings={this.pluginSettings}
        quickEditExpandedId={this.quickEditExpandedId}
        onQuickEditOpen={this.onQuickEditOpen}
        onDelete={this.onDelete}
        onArchive={this.onArchive}
        onNavigate={this.onNavigate}
        access={this.access}
        compact={compact}
      />
    );
  }

  @bound private tableActions(row: any): ReactNode {
    return this.actionsFor(row, false);
  }

  @bound private cardActions(row: any): ReactNode {
    return this.actionsFor(row, true);
  }

  @bound private renderQuickEdit(row: any): ReactNode {
    const rowId = String(row.id);
    if (this.quickEditExpandedId !== rowId) return null;
    return (
      <CollectionQuickEditCard
        row={row}
        collection={this.collection}
        resolvedSlug={this.resolvedSlug}
        quickEditFields={this.quickEditFields}
        quickEditData={this.quickEditData}
        setQuickEditData={this.setQuickEditData}
        quickEditStatus={this.quickEditStatus}
        isLoadingRow={this.quickEditLoadingId === rowId}
        isSavingRow={this.quickEditSavingId === rowId}
        onSave={this.onQuickEditSave}
        onClose={this.onQuickEditClose}
        theme={this.theme}
        pluginSettings={this.pluginSettings}
      />
    );
  }

  render(): ReactNode {
    const slotProps = { collection: this.collection, pluginSlug: this.pluginSlug, resolvedSlug: this.resolvedSlug, total: this.total, page: this.page, search: this.search };
    return (
      <>
        <Slot name={`admin.collection.${this.slotSlug}.list.top`} props={slotProps} />
        <div className={`rounded-xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
          this.theme === ThemeMode.DARK ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
        }`}>
          <div className="fc-list-table">
            <DataTable
              columns={this.columns}
              stickyColumnIds={this.stickyColumnIds}
              data={this.data || []}
              loading={this.loading}
              totalDocs={this.total}
              limit={this.pageSize}
              page={this.page}
              onPageChange={this.onPageChange}
              onSort={this.onSort}
              currentSort={this.sort}
              emptyMessage={this.loadError || undefined}
              onRowClick={this.onRowClick}
              selectable
              selectedIds={this.selectedIds}
              onSelectionChange={this.setSelectedIds}
              expandedRowId={this.quickEditExpandedId}
              actions={this.tableActions}
              renderExpandedRow={this.renderQuickEdit}
            />
          </div>
          <div className="fc-list-cards">
            <CollectionListCards
              data={this.data || []}
              layout={this.layout}
              cells={this.cardCells}
              loading={this.loading}
              emptyMessage={this.loadError || undefined}
              total={this.total}
              page={this.page}
              pageSize={this.pageSize}
              onPageChange={this.onPageChange}
              onOpen={this.onRowClick}
              renderActions={this.cardActions}
              renderExpanded={this.renderQuickEdit}
              selectedIds={this.selectedIds}
              onSelectionChange={this.setSelectedIds}
            />
          </div>
        </div>
        <Slot name={`admin.collection.${this.slotSlug}.list.bottom`} props={slotProps} />
      </>
    );
  }
}
