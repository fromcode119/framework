/**
 * Where ids live inside a `json` field's document, so an import can re-point them.
 *
 * A `relationship` field says what it points at, and an `array`/`group` field's sub-fields say it
 * for what they nest. A `json` field says nothing: its document is opaque, and an id inside it is
 * indistinguishable from a quantity or a price, so an import leaves it exactly as written and the
 * value keeps the SOURCE deployment's numbering.
 *
 * That is correct for most of what such a document holds — a courier's own office id, the record of
 * an earlier migration — and wrong for the ids that are this platform's. This declaration is how a
 * field tells the two apart, without changing its type: a `json` column stays `jsonb`, where an
 * `array` field would map to `TEXT` and the schema builder never alters an existing column's type.
 */
export interface IJsonFieldReference {
  /**
   * Keys below the column, to the id. Arrays on the way are walked element-wise, so `['id']` on a
   * column holding a list of line items re-points every `items[].id`.
   */
  path: string[];

  /** The collection the id points at, written as a `relationship` field's `relationTo` is. */
  relationTo: string;

  /** An id here that the archive carries no record for drops the whole element rather than nulling it. */
  required?: boolean;
}
