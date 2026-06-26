import React from 'react';

import { CollectionListPageActions } from './page-actions';
import { CollectionListUtils } from './utils';
import type { CollectionListPageViewModel } from './collection-list-page.interfaces';

interface BuildPageClientPropsArgs {
  pluginSlug: string;
  slug: string;
  state: CollectionListPageViewModel;
}

export class CollectionListPageProps {
  static build({ pluginSlug, slug, state }: BuildPageClientPropsArgs) {
    const {
      router, settings, theme, columnsMenuRef, collection, resolvedSlug, slotSlug,
      data, pluginSettings, total, loading, search, setSearch, page, setPage, sort, handleSort,
      selectedIds, setSelectedIds, statusFilter, setStatusFilter, fieldFilters, setFieldFilters,
      visibleColumnIds, setVisibleColumnIds, showColumnsMenu, setShowColumnsMenu,
      quickEditExpandedId, setQuickEditExpandedId, quickEditLoadingId, setQuickEditLoadingId, quickEditSavingId, setQuickEditSavingId,
      quickEditData, setQuickEditData, quickEditInitialData, setQuickEditInitialData, quickEditStatus, setQuickEditStatus,
      quickEditFields, deleteDialogState, setDeleteDialogState, deleteLoading, setDeleteLoading,
      statusOptions, allColumns, selectFilterFields, columns, setLoading, fetchData, handleExport, frontendUrl, pageSize
    } = state;

    const toolbarProps = {
      filterBarProps: {
        collection, slug, theme, search, setSearch, statusFilter, setStatusFilter, statusOptions, setPage,
        showColumnsMenu, setShowColumnsMenu, columnsMenuRef, allColumns, visibleColumnIds,
        toggleColumn: (columnId: string) => CollectionListPageActions.toggleColumn({ columnId, pluginSlug, resolvedSlug, setVisibleColumnIds }),
        reorderColumn: (columnId: string, direction: 'up' | 'down') => CollectionListPageActions.reorderColumn({ columnId, direction, pluginSlug, resolvedSlug, setVisibleColumnIds }),
        selectFilterFields, fieldFilters, setFieldFilters,
        prettifyColumnName: CollectionListUtils.prettifyColumnName
      },
      bulkActionsProps: {
        selectedIds, statusOptions, collection, slotSlug, resolvedSlug,
        handleBulkStatusChange: (newStatus: string) => CollectionListPageActions.handleBulkStatusChange({ resolvedSlug, selectedIds, newStatus, page, setLoading, setSelectedIds, fetchData }),
        handleExport,
        handleBulkDelete: () => selectedIds.length && setDeleteDialogState({ mode: 'bulk', ids: [...selectedIds] }),
        setSelectedIds
      }
    };

    const tableProps = {
      collection, pluginSlug, slug, slotSlug, resolvedSlug, theme, total, page, search, columns, data, loading, sort,
      onPageChange: setPage,
      onSort: handleSort,
      onRowClick: (row: any) => router.push(`/${pluginSlug}/${slug}/${row.id}`),
      selectedIds, setSelectedIds, quickEditExpandedId, quickEditLoadingId, quickEditSavingId, quickEditData, setQuickEditData,
      quickEditStatus, quickEditFields, pluginSettings, frontendUrl,
      permalinkStructure: settings?.permalink_structure,
      onDelete: (id: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setDeleteDialogState({ mode: 'single', id });
      },
      onQuickEditOpen: (row: any, event: React.MouseEvent) => CollectionListPageActions.handleQuickEditOpen({
        row, event, resolvedSlug, quickEditExpandedId, setQuickEditExpandedId, setQuickEditStatus,
        setQuickEditLoadingId, setQuickEditData, setQuickEditInitialData
      }),
      onQuickEditSave: () => CollectionListPageActions.handleQuickEditSave({
        quickEditExpandedId, quickEditData, quickEditInitialData, resolvedSlug, page,
        setQuickEditSavingId, setQuickEditStatus, setQuickEditInitialData, fetchData
      }),
      onQuickEditClose: () => setQuickEditExpandedId(null)
    };

    const footerProps = {
      theme, slug, total, resolvedSlug, handleExport,
      handleImport: (event: React.ChangeEvent<HTMLInputElement>) => CollectionListPageActions.handleImport(event, resolvedSlug)
    };

    const deleteDialogProps = {
      deleteDialogState, deleteLoading,
      onClose: () => {
        if (!deleteLoading) setDeleteDialogState(null);
      },
      onConfirm: () => CollectionListPageActions.handleDeleteConfirm({
        deleteDialogState, resolvedSlug, total, page, pageSize, quickEditExpandedId, setDeleteLoading,
        setDeleteDialogState, setSelectedIds, setQuickEditExpandedId, setQuickEditStatus, setPage, fetchData
      })
    };

    return { toolbarProps, tableProps, footerProps, deleteDialogProps };
  }
}
