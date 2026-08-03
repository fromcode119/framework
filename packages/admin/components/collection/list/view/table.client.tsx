import { ThemeMode } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';

import { CollectionQuickEditCard } from '@/components/collection/view/collection-quick-edit-card.client';
import { DataTable } from '@/components/ui/view/data-table.client';

import { CollectionListRowActions } from '@/components/collection/list/view/row-actions.client';

export class CollectionListTable extends PureReactor {
  @prop declare collection: any;
  @prop declare pluginSlug: string;
  @prop declare slug: string;
  @prop declare slotSlug: string;
  @prop declare resolvedSlug: string;
  @prop declare theme: ThemeMode;
  @prop declare total: number;
  @prop declare page: number;
  @prop declare search: string;
  @prop declare columns: any[];
  @prop declare data: any[];
  @prop declare loading: boolean;
  @prop declare sort: string;
  @prop declare onPageChange: (page: number) => void;
  @prop declare onSort: (sort: string) => void;
  @prop declare onRowClick: (row: any) => void;
  @prop declare selectedIds: string[];
  @prop declare setSelectedIds: Dispatch<SetStateAction<string[]>>;
  @prop declare quickEditExpandedId: string | null;
  @prop declare quickEditLoadingId: string | null;
  @prop declare quickEditSavingId: string | null;
  @prop declare quickEditData: Record<string, any>;
  @prop declare setQuickEditData: Dispatch<SetStateAction<Record<string, any>>>;
  @prop declare quickEditStatus: { type: NotificationType; message: string } | null;
  @prop declare quickEditFields: any[];
  @prop declare pluginSettings: Record<string, any>;
  @prop declare frontendUrl: string;
  @prop declare permalinkStructure?: string;
  @prop declare onDelete: (id: string, event: MouseEvent) => void;
  @prop declare onQuickEditOpen: (row: any, event: MouseEvent) => void;
  @prop declare onQuickEditSave: () => void;
  @prop declare onQuickEditClose: () => void;

  render(): ReactNode {
    const {
  collection,
  pluginSlug,
  slug,
  slotSlug,
  resolvedSlug,
  theme,
  total,
  page,
  search,
  columns,
  data,
  loading,
  sort,
  onPageChange,
  onSort,
  onRowClick,
  selectedIds,
  setSelectedIds,
  quickEditExpandedId,
  quickEditLoadingId,
  quickEditSavingId,
  quickEditData,
  setQuickEditData,
  quickEditStatus,
  quickEditFields,
  pluginSettings,
  frontendUrl,
  permalinkStructure,
  onDelete,
  onQuickEditOpen,
  onQuickEditSave,
  onQuickEditClose
} = this;
  return (
    <>
      <Slot
        name={`admin.collection.${slotSlug}.list.top`}
        props={{ collection, pluginSlug, resolvedSlug, total, page, search }}
      />
      <div className={`rounded-xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
        theme === ThemeMode.DARK ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
      }`}>
        <DataTable
          columns={columns}
          data={data || []}
          loading={loading}
          totalDocs={total}
          limit={10}
          page={page}
          onPageChange={onPageChange}
          onSort={onSort}
          currentSort={sort}
          onRowClick={onRowClick}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          expandedRowId={quickEditExpandedId}
          actions={(row) => (
            <CollectionListRowActions
              row={row}
              collection={collection}
              pluginSlug={pluginSlug}
              slug={slug}
              slotSlug={slotSlug}
              resolvedSlug={resolvedSlug}
              theme={theme}
              frontendUrl={frontendUrl}
              permalinkStructure={permalinkStructure}
              pluginSettings={pluginSettings}
              quickEditExpandedId={quickEditExpandedId}
              onQuickEditOpen={onQuickEditOpen}
              onDelete={onDelete}
            />
          )}
          renderExpandedRow={(row) => {
            const rowId = String(row.id);
            if (quickEditExpandedId !== rowId) return null;

            return (
              <CollectionQuickEditCard
                row={row}
                collection={collection}
                resolvedSlug={resolvedSlug}
                quickEditFields={quickEditFields}
                quickEditData={quickEditData}
                setQuickEditData={setQuickEditData}
                quickEditStatus={quickEditStatus}
                isLoadingRow={quickEditLoadingId === rowId}
                isSavingRow={quickEditSavingId === rowId}
                onSave={onQuickEditSave}
                onClose={onQuickEditClose}
                theme={theme}
                pluginSettings={pluginSettings}
              />
            );
          }}
        />
      </div>
      <Slot
        name={`admin.collection.${slotSlug}.list.bottom`}
        props={{ collection, pluginSlug, resolvedSlug, total, page, search }}
      />
    </>
  );
  }
}
