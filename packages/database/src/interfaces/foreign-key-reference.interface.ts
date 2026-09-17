/**
 * One FOREIGN KEY, as the database reports it.
 *
 * Deliberately plain: the caller turns this into whatever it models a reference with. The driver
 * cannot construct core's `TenantColumnReference` — that is the layering this exists to keep.
 */
export interface IForeignKeyReference {
  /** The table holding the constraint. */
  table: string;
  /** The column in `table` that points away. */
  column: string;
  /** The table it points at. */
  targetTable: string;
}
