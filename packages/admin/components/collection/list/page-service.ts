import { Platform } from '@fromcode119/react-class-components';
import { ExportFormat } from '@/components/collection/list/enums/export-format.enum';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/view/badge.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

import { CollectionListRelationshipCellValue } from '@/components/collection/list/view/relationship-cell-value.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { RecordOperations } from '@/components/collection/list/record-operations';
import { RecordCellRenderers } from '@/components/collection/list/record-cell-renderers';

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

    const timestamps = collection.timestamps !== undefined ? collection.timestamps : true;
    const hasWorkflow = Boolean(collection.workflow);

    return columnNames.map((columnName) => {
      const field = collection.fields.find((item: any) => item.name === columnName);
      const header = field?.label || CollectionListUtils.prettifyColumnName(columnName);
      return {
        id: columnName,
        header,
        sortable: CollectionListPageService.isSortableColumn(columnName, field, { timestamps, hasWorkflow }),
        accessor: (row: any) => RecordCellRenderers.renderCellValue({ columnName, field, header, raw: row[columnName] })
      };
    });
  }

  /**
   * Whether clicking this column header actually changes the order of the returned rows.
   *
   * Every column used to be `sortable: true`, so every header rendered a sort arrow. The API's
   * `QueryHelper.buildOrderBy` looks the sort key up on the virtual table and, when it is not there,
   * SILENTLY falls back to `desc(primaryKey)` — the rows come back in id order while the arrow
   * renders as applied, and `handleSort` then PERSISTS that dead sort key to the operator's saved UI
   * preferences, so the wrong order sticks across sessions.
   *
   * `QueryHelper.getVirtualTable` gives every DECLARED field a column, and adds `createdAt`/
   * `updatedAt` when `timestamps` and `status` when `workflow`. Anything outside that set — most
   * commonly an `admin.defaultColumns` entry naming something that is not a field — cannot be
   * ordered by. A `ui` field is excluded too: it is presentational and holds no stored value, so
   * ordering by it is a no-op that still looks applied.
   */
  private static isSortableColumn(
    columnName: string,
    field: any,
    schema: { timestamps: boolean; hasWorkflow: boolean },
  ): boolean {
    if (field) return String(field.type) !== 'ui';
    if (columnName === 'id') return true;
    if (schema.timestamps && (columnName === 'createdAt' || columnName === 'updatedAt')) return true;
    return schema.hasWorkflow && columnName === 'status';
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

}
