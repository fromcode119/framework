import type { IStructuredEntry } from './structured-entry.interface';

/**
 * A normalised node in the row tree `StructuredReadOnlyFieldService` builds out of an arbitrary
 * JSON value. `object`/`array`/`array-table` are container kinds (rendered as collapsible groups
 * or a table); `scalar` and `empty` render inline.
 */
export interface IStructuredNode {
  kind: 'object' | 'array' | 'array-table' | 'scalar' | 'empty';
  /** Set only when `kind === 'scalar'`. */
  scalarValue?: unknown;
  /** Set only when `kind === 'object'`. */
  entries?: IStructuredEntry[];
  /** Set when `kind === 'array'` or `'array-table'` — every item, in order. */
  items?: IStructuredNode[];
  /** Set only when `kind === 'array-table'` — the union of keys across the array's objects. */
  tableColumns?: string[];
  /** Set only when `kind === 'array-table'` — one row per array item, keyed by column. */
  tableRows?: Record<string, IStructuredNode>[];
}
