import type { IForeignKeyReference } from '@database/interfaces/foreign-key-reference.interface';

/**
 * What the database itself says about its own tables.
 *
 * Every method here was a raw `information_schema` / `pg_catalog` query written inside CORE, which
 * is the layer that must work against any driver. Core needed the ANSWERS — which tables carry a
 * column, which are serial, what points at what — and having no way to ask for them, it asked
 * Postgres directly. Asking is now the driver's job; core reads the results.
 *
 * A driver that cannot introspect returns nothing rather than throwing. Empty is a truthful answer
 * for a database that cannot be asked, and it keeps the caller's shape identical either way.
 */
export interface ISchemaIntrospection {
  /** Tables in the current schema carrying `column`. */
  tablesWithColumn(column: string): Promise<string[]>;

  /** table → { column: declared type }, in ordinal order. */
  columnTypes(tables: string[]): Promise<Map<string, Record<string, string>>>;

  /**
   * table → columns declared NOT NULL with no default.
   *
   * `id` and the tenant column are excluded by the caller's contract, not here: they are always
   * supplied by the inserter, so reporting them would make every table look like it needs them.
   */
  requiredColumns(tables: string[], excluding: string[]): Promise<Map<string, Set<string>>>;

  /** table → sequence name, for every table whose `id` defaults to a sequence. */
  serialSequences(tables: string[]): Promise<Map<string, string>>;

  /** Every FOREIGN KEY among `tables`, as plain references the caller maps to its own type. */
  foreignKeys(tables: string[]): Promise<IForeignKeyReference[]>;

  /**
   * table → the columns of a UNIQUE or PRIMARY KEY constraint that already includes `tenantColumn`,
   * with `tenantColumn` itself removed — the columns that identify ONE tenant's row among its own,
   * for a table with no serial `id` (`_system_meta`'s `("key", "tenant_id")`).
   *
   * Only a constraint that ALREADY names the tenant column qualifies: that is what makes a tenant's
   * row distinct from an unowned one at the database level, which is exactly what an importer's
   * upsert needs to target. A table whose natural-key constraint does not include the tenant column
   * is a DIFFERENT, older defect (`tenantBlindUniqueConstraintsStatement` finds those, for the sweep
   * to widen) and reports no columns here.
   */
  naturalKeyColumns(tables: string[], tenantColumn: string): Promise<Map<string, string[]>>;
}
