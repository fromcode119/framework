/**
 * One `relationship` sub-field found below a column, and the path through the JSON that reaches it.
 *
 * `path` is the route from the column's own value down to the id — empty for a relationship declared
 * directly on the column, `['addon']` for a sub-field of an `array`/`group`. It is the SCHEMA's
 * shape, which is what makes re-pointing safe: an importer that walked JSON generically could not
 * tell an id from a quantity or a price.
 */
export interface INestedFieldReference {
  path: string[];
  relationTo: string;
  hasMany: boolean;
  required: boolean;
}
