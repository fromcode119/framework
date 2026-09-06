/**
 * One column of one tenant table that holds the id of a row in another (or the same) table.
 *
 * This is what an id remap follows: when an imported row gets a new id because its old one was
 * taken, every column that pointed at the old id has to be re-pointed. Two sources feed it — the
 * database's own FOREIGN KEY constraints, and the `relationship` fields of the collection schemas
 * plugins register (most plugin tables declare their relations there and not as constraints).
 */
export class TenantColumnReference {
  constructor(
    readonly table: string,
    readonly column: string,
    readonly targetTable: string,
    readonly source: 'fk' | 'schema',
  ) {}

  get isSelfReference(): boolean {
    return this.table === this.targetTable;
  }
}
