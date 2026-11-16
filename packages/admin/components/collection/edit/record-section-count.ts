import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';

/**
 * How many things a section holds, for its own head — "Variants 4", "Images 0".
 *
 * A section whose content is a list says its size in the one place the reader looks before deciding
 * whether to open it. Without it, the only way to learn that a product has four variants is to scroll
 * the card and count them, and the only way to learn it has none is to find the row that says so.
 *
 * It answers only for a section whose content IS one list: one field the console reads as data. A
 * section of separate facts has no number — "Pricing 3" would be counting its fields, which is a fact
 * about the schema and not about the record.
 */
export class RecordSectionCount {
  /** The number to put in the section's head, or `null` when there is nothing to count. */
  static of(fields: any[], record: Record<string, any>): number | null {
    const data = (fields || []).filter((field: any) => RecordSectionFields.readsAsData(field));
    if (data.length !== 1) return null;
    const value = record?.[data[0].name];
    const size = Array.isArray(value) ? value.length
      : (value && typeof value === 'object') ? Object.keys(value).length
        : 0;
    // A count is drawn only when there is something to count. A zero beside a section's name borrows
    // that name's meaning: "Variants 0" reads as a number of variants, but "Price 0" reads as the
    // price being zero, and the console cannot know which of its sections are named for a countable
    // thing. An empty section already says so in its own rows, each with a dash.
    return size > 0 ? size : null;
  }
}
