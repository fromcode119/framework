import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';

/**
 * What the provisioning code needs to know about one tenant table on THIS platform: its columns and
 * their types, whether it has a serial `id`, which of its columns hold JSON, and which point at other
 * rows. Built by `TenantTableCatalog`, read by the exporter, the planner, the executor and the eraser.
 */
export class TenantTableDescriptor {
  constructor(
    readonly name: string,
    /** Column name → `information_schema.columns.data_type` (`integer`, `jsonb`, `text`, …). */
    readonly columnTypes: Record<string, string>,
    /** True when `id` exists and is fed by a sequence — the only case an import may need to remap. */
    readonly hasSerialId: boolean,
    /** The sequence feeding `id`, when `hasSerialId`. */
    readonly idSequence: string | null,
    readonly references: TenantColumnReference[],
    /** Columns declared NOT NULL with no default on THIS platform: a null (or cleared reference) needs a value. */
    readonly requiredColumns: Set<string> = new Set(),
  ) {}

  get columns(): string[] {
    return Object.keys(this.columnTypes);
  }

  hasColumn(column: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.columnTypes, column);
  }

  /**
   * The value a required column takes when the archive has null for it — a source that never enforced
   * NOT NULL, or a column added NOT NULL on this platform after the export. The type's empty value, the
   * SAME substitution the schema builder makes when it adds a required column to a populated table.
   */
  emptyValueFor(column: string): unknown {
    const type = this.columnTypes[column];
    if (type === 'boolean') return false;
    // A REQUIRED jsonb column needs a JSON value, not SQL null: the JSON null literal ('null'::jsonb)
    // satisfies NOT NULL and reads as "no value". `encode` passes this string straight to jsonb.
    if (TenantTableDescriptor.isJsonType(type)) return 'null';
    if (['integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real'].includes(type)) return 0;
    if (type?.startsWith('timestamp') || type === 'date') return new Date().toISOString();
    return '';
  }

  /** Columns whose values are JSON documents — opaque to the id remap, and stringified on insert. */
  get jsonColumns(): string[] {
    return this.columns.filter((column) => TenantTableDescriptor.isJsonType(this.columnTypes[column]));
  }

  get booleanColumns(): string[] {
    return this.columns.filter((column) => this.columnTypes[column] === 'boolean');
  }

  get hasTenantColumn(): boolean {
    return this.hasColumn('tenant_id');
  }

  /** Every table this one points at, itself excluded — the edges a dependency order is built from. */
  get dependsOn(): string[] {
    return [...new Set(this.references.filter((ref) => !ref.isSelfReference).map((ref) => ref.targetTable))];
  }

  get selfReferences(): TenantColumnReference[] {
    return this.references.filter((ref) => ref.isSelfReference);
  }

  static isJsonType(dataType: string | undefined): boolean {
    const type = String(dataType ?? '').toLowerCase();
    return type === 'json' || type === 'jsonb';
  }

  /**
   * Every `information_schema` `data_type` in which an empty string is a VALUE, not an absence.
   *
   * Declared once because it was spelled inline twice and the copies had already drifted — the row
   * inserter tested only `text` and `character varying`, so a `char(n)` column looked non-textual
   * and its empty strings were rewritten to NULL or to the column's empty default. Silent data loss
   * on import, from a hand-written list standing in for a property.
   *
   * These are the SQL-standard spellings this column reports, not Postgres' internal names:
   * `varchar` appears as `character varying`, `char` as `character`, and `bpchar` never appears.
   * `citext` reports its own name and is a character type by definition, so it is listed rather than
   * omitted for not being in use today.
   */
  static isCharacterType(dataType: string | undefined): boolean {
    const type = String(dataType ?? '').toLowerCase();
    return type === 'text' || type === 'character varying' || type === 'character' || type === 'citext';
  }
}
