/**
 * The row-timestamp columns every collection table carries: `created_at` and `updated_at`.
 *
 * The schema builders emit them with `DEFAULT CURRENT_TIMESTAMP` when no field claims them. A field
 * that DOES claim one (a collection declaring its own editable `createdAt`) must keep that default,
 * or every row inserted without an explicit value is stored with no timestamp at all.
 */
export class RowTimestampColumn {
  static readonly NAMES: ReadonlySet<string> = new Set(['created_at', 'updated_at']);

  /** `date` and `datetime` are both stored as a point in time. */
  private static readonly POINT_IN_TIME_TYPES: ReadonlySet<string> = new Set(['date', 'datetime']);

  /** A claimed row-timestamp column that declares no default of its own. */
  static needsDefault(columnName: string, fieldType: string, declaredDefault: unknown): boolean {
    return RowTimestampColumn.NAMES.has(columnName)
      && RowTimestampColumn.POINT_IN_TIME_TYPES.has(fieldType)
      && declaredDefault === undefined;
  }
}
