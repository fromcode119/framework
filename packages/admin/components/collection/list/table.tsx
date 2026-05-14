"use client";

import React from 'react';
import { Slot } from '@fromcode119/react';

import { CollectionQuickEditCard } from '@/components/collection/collection-quick-edit-card';
import { DataTable } from '@/components/ui/data-table';

import { CollectionListRowActions } from './row-actions';

export function CollectionListTable({
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
}: {
  collection: any;
  pluginSlug: string;
  slug: string;
  slotSlug: string;
  resolvedSlug: string;
  theme: string;
  total: number;
  page: number;
  search: string;
  columns: any[];
  data: any[];
  loading: boolean;
  sort: string;
  onPageChange: (page: number) => void;
  onSort: (sort: string) => void;
  onRowClick: (row: any) => void;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  quickEditExpandedId: string | null;
  quickEditLoadingId: string | null;
  quickEditSavingId: string | null;
  quickEditData: Record<string, any>;
  setQuickEditData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  quickEditStatus: { type: 'success' | 'error'; message: string } | null;
  quickEditFields: any[];
  pluginSettings: Record<string, any>;
  frontendUrl: string;
  permalinkStructure?: string;
  onDelete: (id: string, event: React.MouseEvent) => void;
  onQuickEditOpen: (row: any, event: React.MouseEvent) => void;
  onQuickEditSave: () => void;
  onQuickEditClose: () => void;
}) {
  return (
    <>
      <Slot
        name={`admin.collection.${slotSlug}.list.top`}
        props={{ collection, pluginSlug, resolvedSlug, total, page, search }}
      />
      <div className={`rounded-3xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
        theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
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
