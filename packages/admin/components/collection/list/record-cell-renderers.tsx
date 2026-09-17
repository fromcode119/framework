import React from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/view/badge.client';
import { CollectionListRelationshipCellValue } from '@/components/collection/list/view/relationship-cell-value.client';
import { CollectionListUtils } from '@/components/collection/list/utils';

/**
 * Turning one cell's raw value into what the list actually shows.
 *
 * A `.tsx` because it BUILDS REACT ELEMENTS. That is not a filename convention — the OOP guard flags
 * a plain `.ts` importing React as a raw escape hatch, and it is right to: a module that constructs
 * elements is view code, and putting it in a data file is how rendering ends up somewhere nothing
 * expects to find it.
 */
export class RecordCellRenderers {
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
