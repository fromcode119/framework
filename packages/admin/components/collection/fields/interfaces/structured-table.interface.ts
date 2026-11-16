import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/** An array of flat objects, arranged as a table: the columns, the rows, and where a column came from. */
export interface IStructuredTable {
  columns: string[];
  rows: Record<string, IStructuredNode>[];
  /** For a column that was split out of another: the name of the column it came from. */
  columnOrigins?: Record<string, string>;
  /** The columns no row fills — left out of a table the framework arranged, kept in one a field declared. */
  emptyColumns?: string[];
  mediaColumns?: string[];
}
