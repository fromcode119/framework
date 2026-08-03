/** Resolves a logical table name (e.g. `@plugin/entity`) to its physical name. */
export interface ITableNameResolver {
  (name: any): any;
}
