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
  /** The number to put in the section's head, or `null` when the section is not one list. */
  static of(fields: any[], record: Record<string, any>): number | null {
    const data = (fields || []).filter((field: any) => RecordSectionFields.readsAsData(field));
    if (data.length !== 1) return null;
    const value = record?.[data[0].name];
    if (Array.isArray(value)) return value.length;
    // A set of keyed values counts its keys, as a metadata section does.
    if (value && typeof value === 'object') return Object.keys(value).length;
    return RecordSectionFields.isEmpty(data[0], value) ? 0 : null;
  }
}
