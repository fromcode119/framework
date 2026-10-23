import type { CollectionAccess } from '@/lib/collection-access';
import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { Dispatch, MouseEvent, PointerEvent, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';

import { CollectionQuickEditCard } from '@/components/collection/view/collection-quick-edit-card.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { CollectionListRowActions } from '@/components/collection/list/view/row-actions.client';
import { CollectionListCards } from '@/components/collection/list/view/collection-list-cards.client';
import { CollectionListLayout } from '@/components/collection/list/collection-list-layout';
import { QuickEditField } from '@/components/collection/list/quick-edit-field';
import { ListArrangement } from '@/components/collection/list/list-arrangement';
import { ListRecordChange } from '@/components/collection/list/list-record-change';
import { CollectionListReorderHandle } from '@/components/collection/list/view/reorder-handle.client';
import { PointerReorderDrag } from '@/lib/pointer-reorder-drag';
import { DataTableSection } from '@/components/ui/data-table-section';

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
  @prop declare onRowChanged: () => void;
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
  /** Present when the collection declares `admin.list.groupBy` or `admin.list.order`. */
  @prop declare arrangement: ListArrangement | null;
  /** The list shows every record in its own order, so dragging one means something. */
  @prop declare arranged: boolean;
  @prop declare onArrange: (changes: ListRecordChange[]) => void;
  /** Puts the list into its own order — sorted by the order field, unsearched, unfiltered. */
  @prop declare onArrangeMode: () => void;

  @state private dragId = '';
  @state private overId = '';
  @state private dropAfter = false;

  private readonly drag = new PointerReorderDrag(
    'data-row-id',
    (dragId, overId, after) => {
      this.dragId = dragId;
      this.overId = overId;
      this.dropAfter = after;
    },
    (dragId, overId, after) => this.arrange(dragId, overId, after),
    false,
  );

  private arrange(dragId: string, overId: string, after: boolean): void {
    if (!this.arrangement) return;
    const changes = this.arrangement.move(this.data || [], dragId, overId, after);
    if (changes.length) this.onArrange(changes);
  }

  @bound private pressHandle(rowId: string, event: PointerEvent): void {
    this.drag.start(rowId, event);
  }

  @bound private stepRow(rowId: string, up: boolean): void {
    const sections = this.sections;
    const target = sections ? this.arrangement!.step(sections, rowId, up) : this.stepUngrouped(rowId, up);
    if (target) this.arrange(rowId, target.overId, target.after);
  }

  /** One step in a list with an order field but no groups: swap with the neighbour. */
  private stepUngrouped(rowId: string, up: boolean): { overId: string; after: boolean } | null {
    if (!this.arrangement) return null;
    return this.arrangement.step([new DataTableSection('', '', this.data || [])], rowId, up);
  }

  /**
   * The records split by group, when the list is grouped. While the list is in its own order every group
   * shows, empty ones included, so a record can be dragged into a group that has none yet.
   */
  private get sections(): DataTableSection<any>[] | undefined {
    if (!this.arrangement?.groupField) return undefined;
    return this.arrangement.sections(this.data || [], this.arranged);
  }

  @bound private sectionClass(section: DataTableSection<any>): string {
    return this.dragId && section.id === this.overId ? 'fc-drop-into' : '';
  }

  @bound private renderHandle(row: any): ReactNode {
    return (
      <CollectionListReorderHandle
        rowId={String(row.id)}
        enabled={this.arranged}
        onPress={this.pressHandle}
        onStep={this.stepRow}
        onEnable={this.onArrangeMode}
      />
    );
  }

  @bound private rowClass(row: any): string {
    const id = String(row.id);
    if (id === this.dragId) return 'opacity-50';
    if (id === this.overId) return this.dropAfter ? 'fc-drop-after' : 'fc-drop-before';
    return '';
  }

  private get reorderable(): boolean {
    return Boolean(this.arrangement?.orderField);
  }

  private get tableColumns(): any[] {
    if (!this.reorderable) return this.columns;
    return [{ id: '__reorder', header: '', className: 'w-8', accessor: this.renderHandle }, ...this.columns];
  }

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
        onRowChanged={this.onRowChanged}
        quickEditable={this.quickEditFields.length > 0}
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
    const sections = this.sections;
    const slotProps = { collection: this.collection, pluginSlug: this.pluginSlug, resolvedSlug: this.resolvedSlug, total: this.total, page: this.page, search: this.search };
    return (
      <>
        <Slot name={`admin.collection.${this.slotSlug}.list.top`} props={slotProps} />
        <div className={`rounded-xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
          this.theme === ThemeMode.DARK ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
        }`}>
          <div className="fc-list-table">
            <DataTable
              cards={false}
              columns={this.tableColumns}
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
              sections={sections}
              sectionClassName={this.sectionClass}
              rowClassName={this.rowClass}
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
              sections={sections}
              sectionClassName={this.sectionClass}
              renderHandle={this.reorderable ? this.renderHandle : undefined}
              rowClassName={this.rowClass}
            />
          </div>
        </div>
        <Slot name={`admin.collection.${this.slotSlug}.list.bottom`} props={slotProps} />
      </>
    );
  }
}
