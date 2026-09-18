import { StructuredNodeKind } from '@/components/collection/fields/enums/structured-node-kind.enum';
import type { IStructuredEntry } from '@/components/collection/fields/interfaces/structured-entry.interface';

/**
 * A normalised node in the row tree `StructuredReadOnlyFieldService` builds out of an arbitrary
 * JSON value. `object`/`array`/`array-table` are container kinds (rendered as collapsible groups
 * or a table); `scalar` and `empty` render inline.
 */
export interface IStructuredNode {
  kind: StructuredNodeKind;
  /** Set only when `kind === StructuredNodeKind.SCALAR`. */
  scalarValue?: unknown;
  /** Set only when `kind === StructuredNodeKind.OBJECT`. */
  entries?: IStructuredEntry[];
  /** Set when `kind === StructuredNodeKind.ARRAY` or `'array-table'` — every item, in order. */
  items?: IStructuredNode[];
  /** Set only when `kind === StructuredNodeKind.ARRAY_TABLE` — the union of keys across the array's objects. */
  tableColumns?: string[];
  /** Set only when `kind === StructuredNodeKind.ARRAY_TABLE` — one row per array item, keyed by column. */
  tableRows?: Record<string, IStructuredNode>[];
}
