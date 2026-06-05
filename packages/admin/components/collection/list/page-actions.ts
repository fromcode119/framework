import React from 'react';

import { AdminServices } from '@/lib/admin-services';

import { CollectionListPageService } from './page-service';

const adminServices = AdminServices.getInstance();

export class CollectionListPageActions {
  static toggleColumn({
    columnId,
    pluginSlug,
    resolvedSlug,
    setVisibleColumnIds
  }: {
    columnId: string;
    pluginSlug: string;
    resolvedSlug: string;
    setVisibleColumnIds: React.Dispatch<React.SetStateAction<string[]>>;
  }): void {
    setVisibleColumnIds((prev) => {
      const next = prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId];
      if (!next.length) return prev;
      adminServices.uiPreference.writeCollectionColumns(pluginSlug, resolvedSlug, next);
      return next;
    });
  }

  static reorderColumn({
    columnId,
    direction,
    pluginSlug,
    resolvedSlug,
    setVisibleColumnIds
  }: {
    columnId: string;
    direction: 'up' | 'down';
    pluginSlug: string;
    resolvedSlug: string;
    setVisibleColumnIds: React.Dispatch<React.SetStateAction<string[]>>;
  }): void {
    setVisibleColumnIds((prev) => {
      const idx = prev.indexOf(columnId);
      if (idx === -1) return prev;
      const next = [...prev];
      if (direction === 'up' && idx > 0) {
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      } else if (direction === 'down' && idx < next.length - 1) {
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      } else {
        return prev;
      }
      adminServices.uiPreference.writeCollectionColumns(pluginSlug, resolvedSlug, next);
      return next;
    });
  }

  static handleImport(event: React.ChangeEvent<HTMLInputElement>, resolvedSlug: string): void {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const result = await CollectionListPageService.importRecordsFromText(resolvedSlug, loadEvent.target?.result as string);
        alert(`Imported ${result.success} records successfully. ${result.errors.length} errors.`);
        window.location.reload();
      } catch (error: any) {
        alert(`Import failed: ${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  static async handleBulkStatusChange({
    resolvedSlug,
    selectedIds,
    newStatus,
    page,
    setLoading,
    setSelectedIds,
    fetchData
  }: {
    resolvedSlug: string;
    selectedIds: string[];
    newStatus: string;
    page: number;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
    fetchData: (targetPage?: number) => Promise<void>;
  }): Promise<void> {
    if (!selectedIds.length) return;
    setLoading(true);
    try {
      await CollectionListPageService.updateBulkStatus(resolvedSlug, selectedIds, newStatus);
      setSelectedIds([]);
      await fetchData(page);
    } catch {
      alert('Error updating status');
    } finally {
      setLoading(false);
    }
  }

  static async handleDeleteConfirm({
    deleteDialogState,
    resolvedSlug,
    total,
    page,
    pageSize,
    quickEditExpandedId,
    setDeleteLoading,
    setDeleteDialogState,
    setSelectedIds,
    setQuickEditExpandedId,
    setQuickEditStatus,
    setPage,
    fetchData
  }: {
    deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null;
    resolvedSlug: string;
    total: number;
    page: number;
    pageSize: number;
    quickEditExpandedId: string | null;
    setDeleteLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setDeleteDialogState: React.Dispatch<React.SetStateAction<{ mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null>>;
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
    setQuickEditExpandedId: React.Dispatch<React.SetStateAction<string | null>>;
    setQuickEditStatus: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; message: string } | null>>;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    fetchData: (targetPage?: number) => Promise<void>;
  }): Promise<void> {
    if (!deleteDialogState) return;
    setDeleteLoading(true);
    try {
      const removedCount = await CollectionListPageService.deleteRecords(resolvedSlug, deleteDialogState);
      if (deleteDialogState.mode === 'single') {
        setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== deleteDialogState.id));
        if (quickEditExpandedId === deleteDialogState.id) {
          setQuickEditExpandedId(null);
          setQuickEditStatus(null);
        }
      } else {
        setSelectedIds([]);
      }
      const targetPage = CollectionListPageService.resolveTargetPage({ total, removedCount, pageSize, page });
      if (targetPage !== page) setPage(targetPage);
      await fetchData(targetPage);
    } catch {
      alert(deleteDialogState.mode === 'single' ? 'Error deleting record' : 'Error performing bulk delete');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogState(null);
    }
  }

  static async handleQuickEditOpen({
    row,
    event,
    resolvedSlug,
    quickEditExpandedId,
    setQuickEditExpandedId,
    setQuickEditStatus,
    setQuickEditLoadingId,
    setQuickEditData,
    setQuickEditInitialData
  }: {
    row: any;
    event: React.MouseEvent;
    resolvedSlug: string;
    quickEditExpandedId: string | null;
    setQuickEditExpandedId: React.Dispatch<React.SetStateAction<string | null>>;
    setQuickEditStatus: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; message: string } | null>>;
    setQuickEditLoadingId: React.Dispatch<React.SetStateAction<string | null>>;
    setQuickEditData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setQuickEditInitialData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  }): Promise<void> {
    event.stopPropagation();
    const rowId = String(row.id);
    if (quickEditExpandedId === rowId) {
      setQuickEditExpandedId(null);
      setQuickEditStatus(null);
      return;
    }
    setQuickEditStatus(null);
    setQuickEditExpandedId(rowId);
    setQuickEditLoadingId(rowId);
    try {
      const record = await CollectionListPageService.fetchQuickEditRecord(resolvedSlug, rowId);
      setQuickEditData(record || {});
      setQuickEditInitialData(record || {});
    } catch (error: any) {
      setQuickEditStatus({ type: 'error', message: error?.message || 'Failed to load record for quick edit.' });
      setQuickEditData(row || {});
      setQuickEditInitialData(row || {});
    } finally {
      setQuickEditLoadingId(null);
    }
  }

  static async handleQuickEditSave({
    quickEditExpandedId,
    quickEditData,
    quickEditInitialData,
    resolvedSlug,
    page,
    setQuickEditSavingId,
    setQuickEditStatus,
    setQuickEditInitialData,
    fetchData
  }: {
    quickEditExpandedId: string | null;
    quickEditData: Record<string, any>;
    quickEditInitialData: Record<string, any>;
    resolvedSlug: string;
    page: number;
    setQuickEditSavingId: React.Dispatch<React.SetStateAction<string | null>>;
    setQuickEditStatus: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; message: string } | null>>;
    setQuickEditInitialData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    fetchData: (targetPage?: number) => Promise<void>;
  }): Promise<void> {
    if (!quickEditExpandedId) return;
    setQuickEditSavingId(quickEditExpandedId);
    setQuickEditStatus(null);
    try {
      const payload = CollectionListPageService.resolveQuickEditPayload(quickEditData, quickEditInitialData);
      if (!Object.keys(payload).length) {
        setQuickEditStatus({ type: 'success', message: 'No changes to save.' });
        return;
      }
      await CollectionListPageService.saveQuickEditRecord(resolvedSlug, quickEditExpandedId, payload);
      setQuickEditStatus({ type: 'success', message: 'Record updated successfully.' });
      setQuickEditInitialData({ ...quickEditData });
      await fetchData(page);
    } catch (error: any) {
      setQuickEditStatus({ type: 'error', message: error?.message || 'Failed to save quick edits.' });
    } finally {
      setQuickEditSavingId(null);
    }
  }
}
