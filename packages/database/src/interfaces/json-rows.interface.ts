/**
 * Rows a query returned as one JSON array text, keyed by camelCase field name, with what the reader
 * must turn back into the values the row parser would have given (`JsonRowShape`).
 */
export interface IJsonRows {
  /** `[{...},{...}]` — one object per row, in the query's order. */
  text: string;
  /** Field name -> how to read it back: a timestamp becomes a `Date`, a float a `number`. */
  revive: Record<string, 'timestamp' | 'float'>;
}
