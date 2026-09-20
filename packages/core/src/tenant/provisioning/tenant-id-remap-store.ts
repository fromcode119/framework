import { IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { TenantIdRemap } from '@core/tenant/provisioning/tenant-id-remap';

/**
 * Writes an import's id map down, and reads it back.
 *
 * `TenantIdRemap` lives for one import and is then discarded. That is fine while every reference is
 * rewritten during the run, and wrong the moment one is missed — the rows keep an id belonging to
 * another site's numbering, and the only thing that could fix them, the map, no longer exists.
 *
 * Recording it turns that from an out-of-band reconstruction into a query. It does not make the
 * import more correct; it makes a later correction possible at all.
 *
 * Migration 049 removed most of the exposure rather than this doing it: a table keyed on
 * `(tenant_id, id)` keeps its ids, has no map, and is skipped here. This covers what is left — the
 * tables that still share one pool of numbers and still renumber.
 */
export class TenantIdRemapStore {
  static readonly TABLE = '_system_tenant_import_remap';

  private static readonly logger = new Logger({ namespace: 'TenantIdRemapStore' });

  /** Rows per statement. Large enough to matter on a 20,000-row import, small enough for any driver. */
  private static readonly CHUNK = 500;

  constructor(private readonly db: IDatabaseManager) {}

  /**
   * Record every mapping this import made, for the tables it actually remapped.
   *
   * A table in "preserve" mode kept its ids, so it has nothing to say and is skipped — storing
   * identity rows would triple the table's size to record that nothing happened.
   *
   * Failure here does NOT fail the import. The rows are already in and correct; losing the map means
   * losing a future repair, which is worth a loud warning and not worth rolling back a good import
   * for. That trade is the reason this is called after the data is committed, not inside it.
   */
  async record(tenantId: string, remap: TenantIdRemap): Promise<number> {
    const rows: Array<{ table: string; oldId: string; newId: string }> = [];
    for (const table of remap.remappedTables) {
      for (const [oldId, newId] of remap.entriesFor(table)) rows.push({ table, oldId, newId });
    }
    if (!rows.length) return 0;

    try {
      for (let at = 0; at < rows.length; at += TenantIdRemapStore.CHUNK) {
        const chunk = rows.slice(at, at + TenantIdRemapStore.CHUNK);
        const values = chunk
          .map((row) => `(${TenantIdRemapStore.quote(tenantId)}, ${TenantIdRemapStore.quote(row.table)}, `
            + `${TenantIdRemapStore.quote(row.oldId)}, ${TenantIdRemapStore.quote(row.newId)})`)
          .join(', ');
        await this.db.execute(sql.raw(
          `INSERT INTO ${TenantIdRemapStore.TABLE} (tenant_id, table_name, old_id, new_id) VALUES ${values}`,
        ));
      }
      return rows.length;
    } catch (error) {
      TenantIdRemapStore.logger.warn(
        `Could not record the id map for tenant "${tenantId}" (${rows.length} mapping(s)). The import `
        + 'itself is unaffected, but a reference missed by the catalog can no longer be re-pointed '
        + `from it: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * What `oldId` became, for one table of one tenant — most recent import wins.
   *
   * A tenant imported twice holds both runs. The newest answer is the right one: an id re-mapped by a
   * later import is where the row is NOW, which is what a repair is trying to reach.
   */
  async resolve(tenantId: string, table: string, oldId: string): Promise<string | null> {
    const found = await this.db.queryRaw(
      `SELECT new_id FROM ${TenantIdRemapStore.TABLE} `
      + `WHERE tenant_id = ${TenantIdRemapStore.quote(tenantId)} `
      + `AND table_name = ${TenantIdRemapStore.quote(table)} `
      + `AND old_id = ${TenantIdRemapStore.quote(oldId)} `
      + 'ORDER BY imported_at DESC LIMIT 1',
    );
    const value = found[0]?.new_id;
    return value === undefined || value === null ? null : String(value);
  }

  /** The whole recorded map for a tenant, rebuilt as a `TenantIdRemap` so existing code can use it unchanged. */
  async load(tenantId: string): Promise<TenantIdRemap> {
    const remap = new TenantIdRemap();
    const rows = await this.db.queryRaw(
      `SELECT table_name, old_id, new_id FROM ${TenantIdRemapStore.TABLE} `
      + `WHERE tenant_id = ${TenantIdRemapStore.quote(tenantId)} ORDER BY imported_at ASC`,
    );
    for (const row of rows) {
      const table = String(row.table_name);
      remap.markRemapped(table);
      remap.set(table, String(row.old_id), String(row.new_id));
    }
    return remap;
  }

  /** Whether anything was ever recorded for this tenant — the difference between "no map" and "no change". */
  async hasAny(tenantId: string): Promise<boolean> {
    const found = await this.db.queryRaw(
      `SELECT 1 AS present FROM ${TenantIdRemapStore.TABLE} `
      + `WHERE tenant_id = ${TenantIdRemapStore.quote(tenantId)} LIMIT 1`,
    );
    return found.length > 0;
  }

  /**
   * A single-quoted literal with its own quotes doubled.
   *
   * These values are ids and table names the importer produced, not user input — but they are
   * concatenated into SQL, so they are escaped anyway. The alternative, a parameterised insert of
   * 20,000 rows, is not available through `sql.raw`, and "it cannot contain a quote" is the kind of
   * assumption that stops being true without anyone noticing.
   */
  private static quote(value: string): string {
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}
