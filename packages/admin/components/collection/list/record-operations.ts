import React from 'react';
import type { ReactNode } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { Badge } from '@/components/ui/view/badge.client';
import { CollectionListRelationshipCellValue } from '@/components/collection/list/view/relationship-cell-value.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import { Platform } from '@fromcode119/react-class-components';
import { CollectionListPageService } from '@/components/collection/list/page-service';

/**
 * What the list screen DOES to records: fetch a page of them, import, export, bulk-update, delete,
 * and read or save a quick edit.
 *
 * Every one of these is a request that can fail, and each fails differently — an import reports which
 * rows it could not take, a bulk status change reports how many moved. They are separated from the
 * column and filter configuration, which is pure and never touches the server.
 *
 * Split out of `CollectionListPageService` (325 lines).
 */
export class RecordOperations {
  static async fetchCollectionData({
    resolvedSlug,
    targetPage,
    pageSize,
    search,
    sort,
    statusFilter,
    fieldFilters
  }: {
    resolvedSlug: string;
    targetPage: number;
    pageSize: number;
    search: string;
    sort: string;
    statusFilter: string;
    fieldFilters: Record<string, string>;
  }): Promise<{ docs: any[]; totalDocs: number }> {
    const queryParams = CollectionListPageService.buildFetchQuery({ targetPage, pageSize, search, sort, statusFilter, fieldFilters });
    const result = await AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.ITEM(resolvedSlug)}?${queryParams.toString()}`);
    return result?.docs ? { docs: result.docs, totalDocs: result.totalDocs } : { docs: [], totalDocs: 0 };
  }

  static async loadPluginSettings(pluginSlug?: string): Promise<Record<string, any>> {
    if (!pluginSlug) return {};
    return (await AdminApi.get(`${AdminConstants.ENDPOINTS.PLUGINS.BASE}/${pluginSlug}/settings`)) || {};
  }

  static async importRecordsFromText(resolvedSlug: string, content: string): Promise<any> {
    const payload = JSON.parse(content);
    return AdminApi.post(AdminConstants.ENDPOINTS.COLLECTIONS.IMPORT(resolvedSlug), payload);
  }

  /**
   * Export collection records as a real file download. Uses the authenticated `AdminApi.download`
   * (session cookie + Bearer header, `credentials: 'include'`) and triggers a Blob download via a
   * temporary anchor — the same pattern as the system-backup download. This replaces the old
   * `window.open(...export?token=...)`, which opened a blank tab and frequently downloaded nothing.
   */
  static async exportRecords(resolvedSlug: string, format: ExportFormat, ids?: string[]): Promise<void> {
    if (!Platform.hasWindow) return;
    const params = new URLSearchParams({ format: format.value });
    if (ids?.length) params.append('ids', ids.join(','));
    const { blob, filename } = await AdminApi.download(
      `${AdminConstants.ENDPOINTS.COLLECTIONS.EXPORT(resolvedSlug)}?${params.toString()}`,
    );
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || `${resolvedSlug}_export.${format}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  }

  static async updateBulkStatus(resolvedSlug: string, ids: string[], status: string): Promise<void> {
    await AdminApi.post(AdminConstants.ENDPOINTS.COLLECTIONS.BULK_UPDATE(resolvedSlug), {
      ids,
      data: { status }
    });
  }

  static async deleteRecords(
    resolvedSlug: string,
    deleteDialogState: { mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] }
  ): Promise<number> {
    if (deleteDialogState.mode === 'single') {
      await AdminApi.delete(AdminConstants.ENDPOINTS.COLLECTIONS.DETAIL(resolvedSlug, deleteDialogState.id));
      return 1;
    }

    if (!deleteDialogState.ids.length) return 0;
    await AdminApi.post(AdminConstants.ENDPOINTS.COLLECTIONS.BULK_DELETE(resolvedSlug), { ids: deleteDialogState.ids });
    return deleteDialogState.ids.length;
  }

  static resolveTargetPage({
    total,
    removedCount,
    pageSize,
    page
  }: {
    total: number;
    removedCount: number;
    pageSize: number;
    page: number;
  }): number {
    const totalAfterDelete = Math.max(total - removedCount, 0);
    const maxValidPage = Math.max(1, Math.ceil(totalAfterDelete / pageSize));
    return Math.min(page, maxValidPage);
  }

  static async fetchQuickEditRecord(resolvedSlug: string, rowId: string): Promise<any> {
    return AdminApi.get(`${AdminConstants.ENDPOINTS.COLLECTIONS.DETAIL(resolvedSlug, rowId)}?locale_mode=raw`);
  }

  static resolveQuickEditPayload(currentData: Record<string, any>, initialData: Record<string, any>): Record<string, any> {
    const changedEntries = Object.entries(currentData).filter(([key, value]) => {
      return JSON.stringify(value) !== JSON.stringify(initialData?.[key]);
    });
    return Object.fromEntries(changedEntries);
  }

  static async saveQuickEditRecord(resolvedSlug: string, rowId: string, payload: Record<string, any>): Promise<void> {
    await AdminApi.put(AdminConstants.ENDPOINTS.COLLECTIONS.DETAIL(resolvedSlug, rowId), payload);
  }

  static renderCellValue({
    columnName,
    field,
    header,
    raw
  }: {
    columnName: string;
    field: any;
    header: string;
    raw: any;
  }): ReactNode {
    if (columnName === 'status') return this.renderStatusBadge(raw);

    if (CollectionListUtils.shouldRenderBooleanBadge(field, columnName, header, raw)) {
      const booleanBadge = CollectionListUtils.resolveBooleanBadge(columnName, header, raw);
      if (booleanBadge) {
        return React.createElement(Badge, { variant: booleanBadge.variant }, booleanBadge.label);
      }
    }

    if (field?.type === 'relationship') {
      return React.createElement(CollectionListRelationshipCellValue, { relationTo: field.relationTo, raw });
    }

    if (columnName === 'createdAt' || columnName === 'updatedAt' || field?.type === 'date' || field?.type === 'datetime') {
      const date = raw ? new Date(raw) : null;
      if (!date || Number.isNaN(date.getTime())) return '-';
      // System timestamp columns and explicit datetime fields keep the full date+time.
      // Fields typed as "date" (date-only pickers) render without the time component.
      // Show time only for explicit datetime fields. Date fields and system
      // timestamp columns (createdAt/updatedAt) render date-only in list view.
      const isDateOnly = field?.type !== 'datetime';
      return isDateOnly ? date.toLocaleDateString() : date.toLocaleString();
    }

    return CollectionListUtils.formatCellValue(raw);
  }

  static renderStatusBadge(raw: any): ReactNode {
    const value = String(raw || '').trim();
    if (!value) return '-';
    const lower = value.toLowerCase();
    const variant =
      lower === 'published' || lower === 'read'
        ? 'success'
        : lower === 'draft' || lower === 'unread' || lower === 'new'
          ? 'warning'
          : lower === 'archived'
            ? 'rose'
            : 'default';
    return React.createElement(Badge, { variant: variant as any }, value);
  }
}
