/**
 * Rows the database itself keeps as written: a declared column cannot change once it has a value, and
 * (optionally) a row cannot be deleted nor the table truncated — whoever connects as the application.
 * The application's own rules say the same; this is what still holds when something bypasses them.
 */
export interface IRowProtection {
  /** Installs (or replaces) the protection of `table` for these PHYSICAL column names. Idempotent. */
  protect(table: string, writeOnceColumns: string[], noDelete: boolean): Promise<void>;

  /** Lets the CURRENT transaction past every protection — only for erasing a whole site after its export. */
  allowWithinTransaction(): Promise<void>;
}
