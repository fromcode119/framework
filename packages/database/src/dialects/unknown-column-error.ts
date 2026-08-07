/**
 * UnknownColumnError - a caller-supplied field name resolved to no column on the target table.
 *
 * Raised instead of letting the name reach SQL. On SQLite an unknown double-quoted identifier is not
 * an error: it degrades to a STRING LITERAL, so the predicate compares the column NAME as text and the
 * query silently returns the wrong rows (nothing, or the entire table when the term is a substring of
 * the name). A thrown error is the only outcome a caller can notice.
 */
export class UnknownColumnError extends Error {
  readonly tableName: string;
  readonly column: string;
  readonly knownColumns: string[];

  constructor(tableName: string, column: string, knownColumns: string[]) {
    super(
      `Unknown column "${column}" on table "${tableName}". ` +
      `Field names must be canonical schema names that resolve to a real column. ` +
      `Known columns: ${knownColumns.join(', ')}`
    );
    this.name = 'UnknownColumnError';
    this.tableName = tableName;
    this.column = column;
    this.knownColumns = knownColumns;
  }
}
