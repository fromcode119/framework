import type { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Turns one archived row into one INSERT on the destination table.
 *
 *  - `tenant_id` is stamped with the destination tenant (never copied: the archive omits it).
 *  - `id` is kept, or replaced through the remap when the table was re-numbered.
 *  - Reference columns are re-pointed through the remap of the table they target.
 *  - Columns the destination lacks are dropped; JSON columns are stringified; booleans that arrive
 *    as SQLite's 0/1 become booleans.
 *  - Self-references (`media_folders.parent_id`) are inserted NULL and set in a second pass, once
 *    every row of the table exists — otherwise a child inserted before its parent fails the FK.
 */
export class TenantRowInserter {
  private readonly selfReferenceColumns: string[];
  private readonly pendingSelfReferences: Array<{ id: unknown; values: Record<string, unknown> }> = [];

  constructor(
    private readonly db: IDatabaseManager,
    private readonly table: TenantTableDescriptor,
    private readonly tenantId: string,
    private readonly remap: TenantIdRemap,
    private readonly files: TenantImportFiles,
    private readonly warnings: string[] = [],
  ) {
    this.selfReferenceColumns = table.selfReferences.map((ref) => ref.column);
  }

  /** Inserts; returns the row's id on the destination when the table has one. */
  async insert(row: Record<string, unknown>): Promise<number | string | null> {
    const values: Record<string, unknown> = {};
    for (const column of Object.keys(row)) {
      if (column === 'tenant_id' || !this.table.hasColumn(column)) continue;
      values[column] = row[column];
    }
    if (this.table.hasTenantColumn) values.tenant_id = this.tenantId;

    const newId = this.table.hasColumn('id') ? this.remap.resolve(this.table.name, row.id) : null;
    if (this.table.hasColumn('id')) values.id = newId;

    for (const reference of this.table.references) {
      if (reference.isSelfReference || !(reference.column in values)) continue;
      values[reference.column] = this.repoint(reference.targetTable, values[reference.column]);
    }
    const deferred: Record<string, unknown> = {};
    for (const column of this.selfReferenceColumns) {
      if (values[column] === null || values[column] === undefined) continue;
      deferred[column] = this.repoint(this.table.name, values[column]);
      values[column] = null;
    }
    if (Object.keys(deferred).length > 0) this.pendingSelfReferences.push({ id: newId, values: deferred });

    if (this.table.name === SystemConstants.TABLE.MEDIA) this.files.rewriteMediaRow(values);

    // A column this platform requires but the archive left null (a source that never enforced it, a
    // cleared dangling reference, a column added NOT NULL here after the export) gets the type's empty
    // value — the row comes in rather than failing the whole import.
    for (const column of this.table.requiredColumns) {
      if (this.table.hasColumn(column) && (values[column] === null || values[column] === undefined)) {
        values[column] = this.table.emptyValueFor(column);
        this.noteBackfilled(column);
      }
    }

    const columns = Object.keys(values);
    const params = columns.map((column) => this.encode(column, values[column]));
    await this.db.queryRaw(TenantSql.insert(this.table.name, columns), params);
    return typeof newId === 'number' || typeof newId === 'string' ? newId : null;
  }

  /** Second pass for self-references, after every row of the table is in. */
  async finishSelfReferences(): Promise<void> {
    if (!this.table.hasColumn('id')) return;
    for (const pending of this.pendingSelfReferences) {
      for (const [column, value] of Object.entries(pending.values)) {
        await this.db.queryRaw(TenantSql.updateColumn(this.table.name, column, 'id'), [this.encode(column, value), pending.id]);
      }
    }
    this.pendingSelfReferences.length = 0;
  }

  /**
   * A reference is a bare id in a plain column, but a `relationship` field the schema declares may be
   * STORED as JSON — a scalar id, `{ id }`, or a list of either (CMS keeps `parent`, `featuredImage`
   * that way). Those shapes are the schema's, not a guess, so they are followed; anything else in a
   * JSON column stays as written.
   */
  private repoint(targetTable: string, value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((entry) => this.repoint(targetTable, entry));
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if ('id' in record && Object.keys(record).length <= 2) return { ...record, id: this.remap.resolve(targetTable, record.id) };
      return value;
    }
    if (typeof value === 'string' && value.startsWith('{')) {
      try { return this.repoint(targetTable, JSON.parse(value)); } catch { return value; }
    }
    // A RE-NUMBERED target has a mapping for every row the archive carried. An id with no mapping points
    // at a row that was not in the archive (deleted in the source; SQLite never enforced the key): the
    // destination WOULD enforce it, so the reference is dropped and said, rather than failing the import.
    if (this.remap.isRemapped(targetTable) && !this.remap.has(targetTable, value)) {
      this.noteDangling(targetTable, value);
      return null;
    }
    return this.remap.resolve(targetTable, value);
  }

  private readonly dangling = new Map<string, number>();

  private readonly backfilled = new Set<string>();

  private noteBackfilled(column: string): void {
    const key = `${this.table.name}.${column}`;
    if (this.backfilled.has(key)) return;
    this.backfilled.add(key);
    this.warnings.push(`"${this.table.name}" required a value for "${column}" that the archive did not have; the empty value was used.`);
  }

  private noteDangling(targetTable: string, value: unknown): void {
    const key = `${this.table.name}->${targetTable}`;
    const count = (this.dangling.get(key) ?? 0) + 1;
    this.dangling.set(key, count);
    const message = `"${this.table.name}" referenced "${targetTable}" row(s) the archive does not carry; those references were cleared.`;
    const index = this.warnings.findIndex((entry) => entry === message);
    if (index < 0) this.warnings.push(message);
    void value;
  }

  private encode(column: string, value: unknown): unknown {
    if (value === undefined) return null;
    const type = this.table.columnTypes[column];
    // SQLite has no types: it stored '' where a value was absent, in columns Postgres types as date,
    // timestamp, integer, numeric or boolean — each of which REJECTS ''. An empty string in any
    // non-text column is "no value" and becomes NULL (a NOT NULL such column was already backfilled).
    if (value === '' && type && type !== 'text' && type !== 'character varying' && !TenantTableDescriptor.isJsonType(type)) {
      return this.table.requiredColumns.has(column) ? this.table.emptyValueFor(column) : null;
    }
    if (TenantTableDescriptor.isJsonType(type)) {
      if (value === null) return null;
      if (typeof value !== 'string') return JSON.stringify(value);
      // SQLite stored whatever the plugin wrote into a "JSON" column: usually JSON text, sometimes a bare
      // string ('EUR', a description) that Postgres' jsonb refuses. A bare string becomes a JSON string,
      // so the value survives instead of failing the whole import.
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(value);
      }
    }
    if (type === 'boolean') {
      if (value === null) return null;
      if (typeof value === 'boolean') return value;
      const text = String(value).trim().toLowerCase();
      return text === '1' || text === 'true' || text === 't';
    }
    return value;
  }
}
