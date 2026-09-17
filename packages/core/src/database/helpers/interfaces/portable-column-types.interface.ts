/** One dialect's spelling for each type that differs. Add a type here, not in a migration. */
export interface IPortableColumnTypes {
  /** A column holding a JSON document. */
  readonly json: string;
  /** The literal for an empty JSON array, as a DEFAULT. */
  readonly jsonEmptyArray: string;
  /** A point in time. */
  readonly timestamp: string;
  /** "when this row was written", as a DEFAULT. */
  readonly now: string;
  /**
   * A string column that is a PRIMARY KEY, a UNIQUE, or the target of a FOREIGN KEY.
   *
   * Separate from an ordinary string because MySQL cannot index one of unbounded length, and getting
   * this wrong does not fail at write time — it fails at CREATE TABLE, on that driver only.
   */
  readonly key: string;
  /**
   * A short string that carries a DEFAULT.
   *
   * Separate from an ordinary TEXT because MySQL refuses one outright: "BLOB, TEXT, GEOMETRY or JSON
   * column can't have a default value". Use it for a status, a source, a type — anything with a
   * declared default or compared by value. A long free-text column with no default stays TEXT.
   */
  readonly shortText: string;
  /**
   * A long free-text column that wants to read back as "" rather than null.
   *
   * PostgreSQL and SQLite give TEXT a `DEFAULT ''`; MySQL forbids a default on TEXT entirely, so
   * there it is nullable and the empty string arrives as null. Every reader of these columns already
   * coalesces, which is why this is safe — and why it is a NAMED type rather than a quiet difference.
   */
  readonly longTextNullable: string;
  /** An auto-assigned integer primary key, including the PRIMARY KEY clause. */
  readonly autoId: string;
  /** Literal true/false, as a DEFAULT. SQLite has no boolean type and stores 1/0. */
  readonly boolTrue: string;
  readonly boolFalse: string;
}
