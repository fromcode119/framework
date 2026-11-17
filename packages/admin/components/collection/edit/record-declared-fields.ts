/**
 * Every field name the COLLECTION declares — which is what the stored record compares its keys
 * against when it says which of them no field covers.
 *
 * It used to compare against the fields the PAGE had drawn, and that made a product accuse 65 of its
 * keys of having no field when most of them have one: `sku` and `slug` are edited on the page, they
 * simply live in a section the operator had not opened.
 */
export class RecordDeclaredFields {
  static of(collection: unknown): string[] {
    const fields = (collection as { fields?: { name?: unknown }[] } | null)?.fields;
    if (!Array.isArray(fields)) return [];
    return fields.map((field) => String(field?.name ?? '')).filter(Boolean);
  }
}
