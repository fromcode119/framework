import React from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { CollectionListRelationshipCellValue } from '@/components/collection/list/view/relationship-cell-value.client';
import { CollectionListMediaCellValue } from '@/components/collection/list/view/media-cell-value.client';
import { PluginCellValue } from '@/components/collection/list/view/plugin-cell-value.client';
import { CollectionListUtils } from '@/components/collection/list/utils';
import { AdminServices } from '@/lib/admin-services';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { TimezoneUtils } from '@/lib/timezone';
import { StatusTone } from '@/components/collection/status-tone';

/**
 * Turning one cell's raw value into what the list actually shows.
 *
 * A `.tsx` because it BUILDS REACT ELEMENTS. That is not a filename convention — the OOP guard flags
 * a plain `.ts` importing React as a raw escape hatch, and it is right to: a module that constructs
 * elements is view code, and putting it in a data file is how rendering ends up somewhere nothing
 * expects to find it.
 */
export class RecordCellRenderers {
  /** Longer than this and a value is a sentence, not a token, so it is not drawn as a chip. */
  private static readonly CHIP_LABEL_LIMIT = 24;
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
    // A number whose 0 is a setting says what the setting is, before any cell formats it as an amount.
    const zero = this.zeroLabel(field, raw);
    if (zero) return zero;
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
    const tone = StatusTone.declared(field, raw);
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
      // A date field shows the day; a datetime field the day and the minute. A list cell holds one line, so
      // a moment this year leaves out its year, as an inbox does; the full moment is in the tooltip.
      // A literal `YYYY-MM-DD` is that calendar day everywhere; formatSystemDate keeps it from shifting.
      if (field?.type !== 'datetime') return TimezoneUtils.formatSystemDate(raw, { year: 'numeric', month: 'numeric', day: 'numeric' });
      // "This year" in the site's timezone, the zone the cell is written in.
      const thisYear = TimezoneUtils.getZonedDateParts(date)?.year === TimezoneUtils.getZonedDateParts(new Date())?.year;
      const short = date.toLocaleString(AdminI18n.locale, thisYear
        ? { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { dateStyle: 'medium', timeStyle: 'short' });
      return React.createElement('span', { title: date.toLocaleString(AdminI18n.locale, { dateStyle: 'full', timeStyle: 'short' }) }, short);
    }

    /**
     * A value the collection chose from a LIST of its own reads as a chip, wherever it is read.
     *
     * The word alone cannot be told from a typed value: "Catalogue and search", "Sold online", "Physical
     * delivery" sat in a card as plain sentences, and nothing said they are one of a few named states
     * rather than something somebody wrote. A chip says it without a word of explanation — which is why
     * every console worth copying puts its sizes, its account states and its statuses in one.
     *
     * A collection that declares a TONE for the option keeps it (handled above); the rest are neutral,
     * because the framework does not guess a colour from a word.
     */
    if (Array.isArray(field?.options) && field.options.length) {
      const values = (Array.isArray(raw) ? raw : [raw]).filter((value) => value !== null && value !== undefined && value !== '');
      if (!values.length) return CollectionListUtils.formatCellValue(raw);
      /**
       * A chip is a TOKEN: a word or two the eye takes in whole, which is why it never wraps. An
       * option whose label is a sentence — "As set for the shop" — makes a chip wider than the column
       * it stands in, and in a 440px side card it was cut off at the edge. Those read as plain text,
       * which wraps like any other value.
       */
      const labels = values.map((value) => this.optionLabel(field, value) || String(value));
      if (labels.some((label) => label.length > RecordCellRenderers.CHIP_LABEL_LIMIT)) {
        return CollectionListUtils.formatCellValue(Array.isArray(raw) ? labels : labels[0]);
      }
      const chips = values.map((value, index) => React.createElement(
        Badge,
        { key: `${String(value)}-${index}`, variant: BadgeVariant.DEFAULT },
        this.optionLabel(field, value) || String(value),
      ));
      return chips.length === 1 ? chips[0] : React.createElement('span', { className: 'fc-chips' }, chips);
    }

    return CollectionListUtils.formatCellValue(raw);
  }

  /**
   * The label the field declares for a stored option value — the words the operator picked in the
   * editor, in the console's language — or '' when the value is not one of its options.
   */
  /** The words a number field declares for a stored 0 (`admin.zeroLabel`), or '' when the value is not 0. */
  static zeroLabel(field: any, raw: any): string {
    const label = field?.admin?.zeroLabel;
    if (!label || field?.type !== 'number' || raw === null || raw === undefined || raw === '') return '';
    return Number(raw) === 0 ? AdminServices.getInstance().localization.resolveLabelText(label) : '';
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
    return React.createElement(Badge, { variant: BadgeVariant.resolve(StatusTone.ofWord(value)) }, label || value);
  }

}
