/**
 * Rows the database keeps as written, whoever connects (Postgres triggers; see IRowProtection). For
 * records that must stay exactly as they were first written.
 *
 * - `writeOnce`: field names (as declared) that cannot change once they hold a value. A field may still
 *   be filled the first time; a field not listed stays editable.
 * - `noDelete`: rows cannot be deleted and the table cannot be truncated.
 *
 * The only exception is erasing a whole site after its export was written.
 */
export interface ICollectionProtection {
  writeOnce?: string[];
  noDelete?: boolean;
}
