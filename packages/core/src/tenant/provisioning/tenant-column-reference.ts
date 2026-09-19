import { TenantColumnSource } from '@core/tenant/provisioning/enums/tenant-column-source.enum';
/**
 * One column of one tenant table that holds the id of a row in another (or the same) table.
 *
 * This is what an id remap follows: when an imported row gets a new id because its old one was
 * taken, every column that pointed at the old id has to be re-pointed. Three sources feed it — the
 * database's own FOREIGN KEY constraints, the `relationship` fields of the collection schemas
 * plugins register (most plugin tables declare their relations there and not as constraints), and
 * the declared POLYMORPHIC pointers whose target table only the row itself names
 * ({@link TenantPolymorphicReferences}).
 *
 * A `schema` reference may point at the id not from the column's own value, but from somewhere
 * INSIDE the JSON it stores — a `hasMany` relationship is a JSON array of ids, and an `array`/`group`
 * field with a `relationship` sub-field stores the id at a key below the column. `path` is that
 * declared route, read off the collection schema; it is empty for a plain column (`fk` references,
 * and single-valued `relationship` columns, always have an empty path).
 */
export class TenantColumnReference {
  constructor(
    readonly table: string,
    readonly column: string,
    readonly targetTable: string,
    readonly source: TenantColumnSource,
    /** JSON keys below `column`, as declared by nested `array`/`group` sub-fields. `[]` = the column itself. */
    readonly path: string[] = [],
    /** The `hasMany` the relationship field declared — informational; `path`/runtime shape drive the walk. */
    readonly hasMany: boolean = false,
    /** The `required` the field at the end of `path` declared — a dangling id there drops the whole element. */
    readonly required: boolean = false,
    /**
     * A column on the SAME row holding the name of the table this reference points at, for a pointer
     * whose target varies row by row. When set, `targetTable` is empty and carries no meaning — the
     * target is read from this column as each row is written.
     */
    readonly targetTableColumn: string | null = null,
  ) {}

  get isPolymorphic(): boolean {
    return this.targetTableColumn !== null;
  }

  /** A polymorphic reference names no fixed table, so it is never the self-reference the FK deferral is for. */
  get isSelfReference(): boolean {
    return !this.isPolymorphic && this.table === this.targetTable;
  }

  /** How this reference is named in a warning or the import preview: `column`, or `column[].a.b` through a path. */
  describe(): string {
    return this.path.length === 0 ? this.column : `${this.column}[].${this.path.join('.')}`;
  }

  /** The target as the preview names it: a table, or the column that names one per row. */
  describeTarget(): string {
    return this.isPolymorphic ? `the table named by "${this.targetTableColumn}"` : this.targetTable;
  }
}
