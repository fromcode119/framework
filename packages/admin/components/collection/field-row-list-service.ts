import type { ICollectionField } from '@/components/collection/interfaces/collection-field.interface';

/**
 * Whether a field holds ROWS, and the rows it holds.
 *
 * `array` says so by its type. A `json` field that declares its sub-fields says the same thing: it is a
 * list of rows whose shape is known, and it used to fall through to the JSON textarea — so a plugin that
 * wanted rows had to draw them itself. That is how a list of videos, a list of specifications and a list
 * of prices-per-currency each turned into a component of its own, none of which had a shape of its own.
 */
export class FieldRowListService {
  /** A json field holding rows of declared sub-fields. */
  static isRowList(field: ICollectionField): boolean {
    const fields = (field as any)?.fields;
    return String(field?.type) === 'json' && Array.isArray(fields) && fields.length > 0;
  }

  /** The rows as stored: a json column may hand back the array itself or its text. */
  static rowsOf(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
