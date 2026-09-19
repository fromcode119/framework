import { TenantColumnSource } from '@core/tenant/provisioning/enums/tenant-column-source.enum';
import type { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';
import { TenantImportFiles } from '@core/tenant/provisioning/tenant-import-files';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';
import { SecretTransitResealer } from '@core/security/secret-transit-resealer';

/**
 * Turns one archived row into one INSERT on the destination table.
 *
 *  - `tenant_id` is stamped with the destination tenant (never copied: the archive omits it).
 *  - `id` is kept, or replaced through the remap when the table was re-numbered.
 *  - Reference columns are re-pointed through the remap of the table they target.
 *  - Columns the destination lacks are dropped; JSON columns are stringified; booleans that arrive
 *    as SQLite's 0/1 become booleans.
 *  - Self-references from a FOREIGN KEY (`media_folders.parent_id`) are inserted NULL and set in a
 *    second pass, once every row of the table exists — otherwise a child inserted before its parent
 *    fails the FK. A self-reference declared only by a `schema` field (a row naming another row of
 *    its own table in a `hasMany` relationship) has no such constraint and needs no deferral: every
 *    id of THIS table was allocated before the first row of it was inserted (see
 *    `TenantImportExecutor`), so the map is already complete.
 */
export class TenantRowInserter {
  /**
   * Marks "this element/column had a dangling id and is being dropped", never written to a row.
   *
   * A symbol rather than `null` or a sentinel number, because the thing it has to be distinguishable
   * from is every value an archive may legitimately carry — including `null`, which is exactly what a
   * dropped scalar column ends up as. Nothing outside this class can construct it, so it cannot
   * arrive from a row and be mistaken for a decision this class made.
   */
  private static readonly DROPPED = Symbol('dropped');

  /** Only FK-backed self-references defer; a `schema` self-reference resolves inline (see above). */
  private readonly deferredSelfReferences: TenantColumnReference[];
  private readonly pendingSelfReferences: Array<{ id: unknown; values: Record<string, unknown> }> = [];

  constructor(
    private readonly db: IDatabaseManager,
    private readonly table: TenantTableDescriptor,
    private readonly tenantId: string,
    private readonly remap: TenantIdRemap,
    private readonly files: TenantImportFiles,
    private readonly warnings: string[] = [],
    /**
     * The passphrase the export sealed its secrets under. Given one, each secret is taken back into
     * THIS deployment's key as the row is written, so an integration works the moment the import
     * finishes instead of needing its credentials typed again.
     */
    private readonly transitPassphrase: string | null = null,
  ) {
    this.deferredSelfReferences = table.selfReferences.filter((ref) => ref.source === TenantColumnSource.FK);
  }

  /** Inserts; returns the row's id on the destination when the table has one. */
  async insert(row: Record<string, unknown>): Promise<number | string | null> {
    const values: Record<string, unknown> = {};
    for (const column of Object.keys(row)) {
      if (column === 'tenant_id' || !this.table.hasColumn(column)) continue;
      values[column] = row[column];
    }
    // After the copy loop: the loop writes the archive's own value for a destination column, and a
    // fold must not be clobbered by the null it wrote for a column the old schema never filled.
    this.foldLegacyColumns(row, values);
    if (this.transitPassphrase) {
      for (const column of Object.keys(values)) {
        values[column] = SecretTransitResealer.openFromTransit(values[column], this.transitPassphrase);
      }
    }
    if (this.table.hasTenantColumn) values.tenant_id = this.tenantId;

    const newId = this.table.hasColumn('id') ? this.remap.resolve(this.table.name, row.id) : null;
    if (this.table.hasColumn('id')) values.id = newId;

    const deferredSet = new Set<TenantColumnReference>(this.deferredSelfReferences);
    for (const reference of this.table.references) {
      if (deferredSet.has(reference) || !(reference.column in values)) continue;
      values[reference.column] = this.repoint(this.resolveTarget(reference, values), values[reference.column]);
    }
    const deferredValues: Record<string, unknown> = {};
    for (const reference of this.deferredSelfReferences) {
      if (values[reference.column] === null || values[reference.column] === undefined) continue;
      deferredValues[reference.column] = this.repoint(reference, values[reference.column]);
      values[reference.column] = null;
    }
    if (Object.keys(deferredValues).length > 0) this.pendingSelfReferences.push({ id: newId, values: deferredValues });

    if (this.table.name === SystemConstants.TABLE.MEDIA) this.files.rewriteMediaRow(values);
    // A renamed upload is referenced from CONTENT too, not only from the media row that owns it —
    // a page's blocks carry `/uploads/<name>` verbatim. Every table, because any column may quote one.
    this.files.rewriteUploadReferences(values);

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

  /**
   * Folds an older schema's columns into the field that replaced them.
   *
   * A deployment that stored an address as eight flat columns still carries the address — it just
   * carries it in the shape of its day, and the destination has no such columns, so every one of
   * them would otherwise be discarded by the loop below. The claim comes from the collection
   * (`IField.legacyColumns`), never from a guess about a column's name.
   *
   * The archive's own value for the destination column wins: if the export already wrote the field,
   * that is the newer truth and the legacy columns are the shadow of it. Empty legacy values are not
   * folded, so an all-empty set leaves the column null rather than writing a husk of empty keys.
   */
  private foldLegacyColumns(row: Record<string, unknown>, values: Record<string, unknown>): void {
    for (const fold of this.table.folds) {
      if (values[fold.column] !== null && values[fold.column] !== undefined) continue;
      const folded: Record<string, unknown> = {};
      for (const [column, key] of Object.entries(fold.legacy)) {
        const value = row[column];
        if (value === null || value === undefined || value === '') continue;
        folded[key] = value;
      }
      if (Object.keys(folded).length > 0) values[fold.column] = folded;
    }
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
   * The reference to follow for THIS row.
   *
   * A fixed reference is itself. A polymorphic one names no table until the row is read: the table
   * comes from the sibling column the declaration points at. When that column is empty, or names a
   * table this import never re-numbered, `null` is returned and the value is left exactly as the
   * archive wrote it — the alternative, resolving against a table that was never remapped, would be
   * a no-op at best and a rewrite against the wrong map at worst.
   */
  private resolveTarget(reference: TenantColumnReference, values: Record<string, unknown>): TenantColumnReference | null {
    if (!reference.isPolymorphic) return reference;
    const target = String(values[reference.targetTableColumn as string] ?? '').trim();
    if (!target || !this.remap.isRemapped(target)) return null;
    return new TenantColumnReference(reference.table, reference.column, target, reference.source, reference.path, reference.hasMany, reference.required);
  }

  /**
   * A reference is a bare id in a plain column, but a `relationship` field the schema declares may be
   * STORED as JSON — a scalar id, `{ id }`, or a list of either (CMS keeps `parent`, `featuredImage`
   * that way), or nested below `reference.path` (a `hasMany` array, or an `array`/`group` sub-field —
   * `addonPricingRules[].addon`). Those shapes are the schema's, not a guess, so they are followed;
   * anything else in a JSON column stays as written. The actual value is walked as it is FOUND — an
   * array is mapped element-wise and an object is descended by key regardless of which of `array` or
   * `group` the field declared, because the archive's JSON is the ground truth for shape, the schema
   * only for where an id lives in it.
   */
  private repoint(reference: TenantColumnReference | null, value: unknown): unknown {
    // No target for this row (see `resolveTarget`) — nothing to follow, so nothing changes.
    if (reference === null) return value;
    const result = this.repointAt(reference, reference.path, value);
    // DROPPED only survives past the top when nothing above it was an array to filter it out of — a
    // plain scalar column with a dangling id, exactly today's `null` behaviour.
    return result === TenantRowInserter.DROPPED ? null : result;
  }

  private repointAt(reference: TenantColumnReference, path: string[], value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      // The column stores JSON as TEXT (a `text`/`character varying` destination — a plugin's own
      // JSON-shaped column declared as plain text rather than jsonb) — its storage shape is a
      // string, not the importer's to change. Parse to walk it, re-point ids inside, then serialise
      // back to a string so a text column still receives a string. `encode()` guards the same shape for any
      // value that reaches it as a live object/array instead of a string (a jsonb SOURCE column
      // landing in a text destination never hits this string branch at all), but that is a
      // different path into the same bug — see `encode`.
      let parsed: unknown;
      try { parsed = JSON.parse(value); } catch { return value; }
      const result = this.repointAt(reference, path, parsed);
      return result === TenantRowInserter.DROPPED ? TenantRowInserter.DROPPED : JSON.stringify(result);
    }
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.repointAt(reference, path, entry))
        .filter((entry) => entry !== TenantRowInserter.DROPPED);
    }
    if (path.length === 0) return this.repointLeaf(reference, value);
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const [key, ...rest] = path;
      if (!(key in record)) return value;
      const nested = this.repointAt(reference, rest, record[key]);
      if (nested === TenantRowInserter.DROPPED) return reference.required ? TenantRowInserter.DROPPED : { ...record, [key]: null };
      return { ...record, [key]: nested };
    }
    // The schema declared a path the archive's own shape does not have here (a scalar where an object
    // was expected) — nothing to rewrite, leave it exactly as the archive wrote it.
    return value;
  }

  /** The `{ id, … }` CMS shape, or a bare id — the two forms a leaf (path exhausted) can take. */
  private repointLeaf(reference: TenantColumnReference, value: unknown): unknown {
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if ('id' in record && Object.keys(record).length <= 2) {
        const resolved = this.repointLeaf(reference, record.id);
        return resolved === TenantRowInserter.DROPPED ? TenantRowInserter.DROPPED : { ...record, id: resolved };
      }
      return value;
    }
    // A RE-NUMBERED target has a mapping for every row the archive carried. An id with no mapping points
    // at a row that was not in the archive (deleted in the source; SQLite never enforced the key): the
    // destination WOULD enforce it, so the reference is dropped and said, rather than failing the import.
    // In PRESERVE mode `isRemapped` is false and the id is the source's own dangling data — untouched.
    if (!this.remap.isRemapped(reference.targetTable) || this.remap.has(reference.targetTable, value)) {
      return this.remap.resolve(reference.targetTable, value);
    }
    this.noteDangling(reference);
    return TenantRowInserter.DROPPED;
  }

  private readonly backfilled = new Set<string>();

  private readonly danglingNoted = new Set<string>();

  private noteBackfilled(column: string): void {
    const key = `${this.table.name}.${column}`;
    if (this.backfilled.has(key)) return;
    this.backfilled.add(key);
    this.warnings.push(`"${this.table.name}" required a value for "${column}" that the archive did not have; the empty value was used.`);
  }

  private noteDangling(reference: TenantColumnReference): void {
    const key = `${this.table.name}.${reference.describe()}->${reference.targetTable}`;
    if (this.danglingNoted.has(key)) return;
    this.danglingNoted.add(key);
    this.warnings.push(`"${this.table.name}"."${reference.describe()}" referenced "${reference.targetTable}" row(s) the archive does not carry; those references were cleared.`);
  }

  private encode(column: string, value: unknown): unknown {
    if (value === undefined) return null;
    const type = this.table.columnTypes[column];
    // SQLite has no types: it stored '' where a value was absent, in columns Postgres types as date,
    // timestamp, integer, numeric or boolean — each of which REJECTS ''. An empty string in any
    // non-text column is "no value" and becomes NULL (a NOT NULL such column was already backfilled).
    if (value === '' && type && !TenantTableDescriptor.isCharacterType(type) && !TenantTableDescriptor.isJsonType(type)) {
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
    // A `text`/`character varying` destination can still receive a live object or array — a jsonb
    // SOURCE column arrives already parsed (SQLite/Postgres both hand back the parsed value for a
    // json/jsonb column), and `repoint` above never touches it because it was never a string to
    // begin with. Handed to the driver as-is, an array serialises as a Postgres ARRAY LITERAL
    // (`{"{...}"}`) instead of JSON, and a plain object fails outright. The column's storage shape
    // is JSON text either way, so stringify it here — this is the one place a value of the wrong
    // JS shape for its destination still gets fixed, regardless of which import path produced it.
    if ((type === 'text' || type === 'character varying') && value !== null && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }
}
