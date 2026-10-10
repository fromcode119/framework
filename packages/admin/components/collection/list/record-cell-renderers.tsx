import React from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { CollectionListRelationshipCellValue } from '@/components/collection/list/view/relationship-cell-value.client';
import { CollectionListMediaCellValue } from '@/components/collection/list/view/media-cell-value.client';
import { PluginCellValue } from '@/components/collection/list/view/plugin-cell-value.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { AdminServices } from '@/lib/admin-services';

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
    raw,
    row
  }: {
    columnName: string;
    field: any;
    header: string;
    raw: any;
    row?: Record<string, any>;
  }): ReactNode {
    // A field that names its own display component (`admin.cell`) is drawn by it — a price in its
    // currency is its plugin's to format, not the list's. The plain rendering stays as its fallback.
    if (field?.admin?.cell && row) {
      return React.createElement(PluginCellValue, {
        componentName: String(field.admin.cell),
        value: raw,
        row,
        field,
        fallback: this.renderCellValue({ columnName, field: { ...field, admin: { ...field.admin, cell: undefined } }, header, raw }),
      });
    }
    // A select whose option names a tone shows as a badge in that tone, in any column: the collection
    // says what "paid" or "cancelled" looks like, the list never guesses from the word.
    const tone = this.optionTone(field, raw);
    if (tone) return React.createElement(Badge, { variant: BadgeVariant.resolve(tone) }, this.optionLabel(field, raw) || String(raw));
    if (columnName === 'status') return this.renderStatusBadge(raw, this.optionLabel(field, raw));

    if (CollectionListUtils.shouldRenderBooleanBadge(field, columnName, header, raw)) {
      const booleanBadge = CollectionListUtils.resolveBooleanBadge(columnName, header, raw);
      if (booleanBadge) {
        return React.createElement(Badge, { variant: booleanBadge.variant }, booleanBadge.label);
      }
    }

    if (field?.type === 'relationship' && field.relationTo === 'media') {
      return React.createElement(CollectionListMediaCellValue, { raw });
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

    if (Array.isArray(field?.options) && field.options.length) {
      const values = Array.isArray(raw) ? raw : [raw];
      const labels = values.map((value) => this.optionLabel(field, value) || value);
      return CollectionListUtils.formatCellValue(Array.isArray(raw) ? labels : labels[0]);
    }

    return CollectionListUtils.formatCellValue(raw);
  }

  /**
   * The label the field declares for a stored option value — the words the operator picked in the
   * editor, in the console's language — or '' when the value is not one of its options.
   */
  /** The tone a select option declares for this value (`success`, `warning`, `danger`, `info`, `default`), or ''. */
  static optionTone(field: any, raw: any): string {
    const value = String(raw ?? '').trim();
    if (!value || !Array.isArray(field?.options)) return '';
    const option = field.options.find((entry: any) => String(entry?.value ?? entry ?? '') === value);
    return option && typeof option === 'object' ? String(option.tone ?? '').trim() : '';
  }

  static optionLabel(field: any, raw: any): string {
    const value = String(raw ?? '').trim();
    if (!value || !Array.isArray(field?.options)) return '';
    const option = field.options.find((entry: any) => String(entry?.value ?? entry ?? '') === value);
    if (!option || option === value) return '';
    return AdminServices.getInstance().localization.resolveLabelText(option.label);
  }

  static renderStatusBadge(raw: any, label: string = ''): ReactNode {
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
    return React.createElement(Badge, { variant: variant as any }, label || value);
  }
}
