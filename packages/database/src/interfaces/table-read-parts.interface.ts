/** The parts of a read on a declared table: which fields, joined to what, filtered, ordered and paged. */
export interface ITableReadParts {
  /** `{ field: true }` — only these fields, as a flat row. */
  columns?: Record<string, boolean>;
  joins?: Array<{ table: object; on?: unknown; type?: string }>;
  where?: any;
  orderBy?: any[];
  limit?: number;
  offset?: number;
}
