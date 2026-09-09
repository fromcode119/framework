/**
 * The manager methods whose FIRST argument is a table name.
 *
 * One list, in the package that owns the manager, because two copies of it drifted and the drift was
 * silent: the factory's resolution proxy listed nine of these and omitted `groupCount` and `upsert`,
 * so those two reached SQL with the caller's `@plugin/entity` alias unresolved and failed with
 * `relation "@hub/rates" does not exist` — a query that had worked everywhere else in the same file.
 *
 * Anything added to the manager that takes a table name belongs here, and only here.
 */
export class TableArgMethods {
  /** Reads. */
  static readonly READ: readonly string[] = ['find', 'findOne', 'count', 'groupCount', 'tableExists', 'getColumns'];

  /** Writes. */
  static readonly WRITE: readonly string[] = ['insert', 'update', 'upsert', 'delete'];

  /** Schema changes. */
  static readonly SCHEMA: readonly string[] = ['addColumn', 'syncCollection'];

  static readonly ALL: readonly string[] = [
    ...TableArgMethods.READ,
    ...TableArgMethods.WRITE,
    ...TableArgMethods.SCHEMA,
  ];

  static has(method: unknown): boolean {
    return typeof method === 'string' && TableArgMethods.ALL.includes(method);
  }
}
