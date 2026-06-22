import React from 'react';

import { Badge } from '@/components/ui/badge';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';

import { CollectionKeyUtils } from '../collection-key-utils';
import { CollectionListRelationshipCellValue } from './relationship-cell-value';
import { CollectionListUtils } from './utils';

export class CollectionListPageService {
  static resolveStatusField(collection: any): any {
    if (!collection) return null;
    return collection.fields.find((field: any) => field?.name === 'status' && field?.type === 'select') || null;
  }

  static resolveStatusOptions(statusField: any): { label: string; value: string }[] {
    const options = Array.isArray(statusField?.options) ? statusField.options : [];
    return options
      .map((option: any) => ({
        label: String(option?.label || option?.value || '').trim(),
        value: String(option?.value || '').trim()
      }))
      .filter((option: { value: string }) => option.value);
  }

  static buildAllColumns(collection: any): any[] {
    if (!collection) return [];
    const hiddenFieldNames = new Set(
      collection.fields
        .filter((field: any) => field?.hidden || field?.admin?.hidden)
        .map((field: any) => field.name)
    );
    const defaultCols = Array.isArray(collection.admin?.defaultColumns) ? collection.admin.defaultColumns : [];
    const fieldCols = collection.fields
      .filter((field: any) => field?.name && !hiddenFieldNames.has(field.name))
      .map((field: any) => field.name);
    const columnNames = Array.from(new Set(['id', ...defaultCols, ...fieldCols, 'createdAt']));

    return columnNames.map((columnName) => {
      const field = collection.fields.find((item: any) => item.name === columnName);
      const header = field?.label || CollectionListUtils.prettifyColumnName(columnName);
      return {
        id: columnName,
        header,
        sortable: true,
        accessor: (row: any) => this.renderCellValue({ columnName, field, header, raw: row[columnName] })
      };
    });
  }

  static resolveSelectFilterFields(collection: any): any[] {
    if (!collection) return [];
    return collection.fields.filter((field: any) => {
      if (!field?.name) return false;
      if (field.hidden || field.admin?.hidden) return false;
      if (field.name === 'status') return false;
      return field.type === 'select' && Array.isArray(field.options) && field.options.length > 0;
    });
  }

  static resolveQuickEditFields(collection: any): any[] {
    if (!collection) return [];
    return collection.fields.filter((field: any) => {
      if (!field?.name) return false;
      if (field.hidden || field.admin?.hidden) return false;
      if (field.admin?.readOnly) return false;
      if (['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(field.name)) return false;
      if (field.type === 'ui') return false;
      if (['json', 'array', 'richText', 'code', 'upload', 'textarea'].includes(field.type)) return false;
      return true;
    });
  }

  static resolveVisibleColumnIds({
    allColumns,
    adminDefaultColumns,
    persistedColumns
  }: {
    allColumns: any[];
    adminDefaultColumns?: string[];
    persistedColumns: string[];
  }): string[] {
    const availableIds = new Set(allColumns.map((column) => column.id));
    let defaults = adminDefaultColumns;

    if (!Array.isArray(defaults) || !defaults.length) {
      const semanticDefaults = ['id', 'title', 'name', 'label', 'slug', 'status', 'createdAt'].filter((id) => availableIds.has(id));
      defaults = semanticDefaults.length ? semanticDefaults : allColumns.slice(0, 4).map((column) => column.id);
    } else {
      defaults = defaults.filter((id) => availableIds.has(id));
      if (availableIds.has('id') && !defaults.includes('id')) defaults = ['id', ...defaults];
      if (availableIds.has('createdAt') && !defaults.includes('createdAt')) defaults = [...defaults, 'createdAt'];
    }

    const uniqueDefaults = Array.from(new Set(defaults));
    const validPersistedColumns = persistedColumns.filter((id) => availableIds.has(id));
    const next = validPersistedColumns.length ? validPersistedColumns : uniqueDefaults;

    if (uniqueDefaults.includes('id') && availableIds.has('id') && !next.includes('id')) {
      return ['id', ...next];
    }

    return next.length ? next : allColumns.slice(0, 4).map((column) => column.id);
  }

  static buildFetchQuery({
    targetPage,
    pageSize,
    search,
    sort,
    statusFilter,
    fieldFilters
  }: {
    targetPage: number;
    pageSize: number;
    search: string;
    sort: string;
    statusFilter: string;
    fieldFilters: Record<string, string>;
  }): URLSearchParams {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(targetPage));
    queryParams.append('limit', String(pageSize));
    if (search) queryParams.append('search', search);
    if (sort) queryParams.append('sort', sort);
    if (statusFilter !== 'all') queryParams.append('status', statusFilter);
    Object.entries(fieldFilters).forEach(([key, value]) => {
      if (value && value !== 'all') queryParams.append(key, value);
    });
    return queryParams;
  }

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
    const queryParams = this.buildFetchQuery({ targetPage, pageSize, search, sort, statusFilter, fieldFilters });
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
  static async exportRecords(resolvedSlug: string, format: 'json' | 'csv', ids?: string[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams({ format });
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

  private static renderCellValue({
    columnName,
    field,
    header,
    raw
  }: {
    columnName: string;
    field: any;
    header: string;
    raw: any;
  }): React.ReactNode {
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

  private static renderStatusBadge(raw: any): React.ReactNode {
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
