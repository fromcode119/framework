import { BaseMigration, IDatabaseManager, IMigrationTenantScope, Sql } from '@fromcode119/database';
import { ApiVersionUtils } from '@core/api-version';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Stored addresses of the api lose their old version segment: `/api/v1/themes/x/ui/logo.png` becomes
 * `/api/themes/x/ui/logo.png`.
 *
 * The api no longer answers `/api/v1/...` at all. Content saved while it did still names that form — a
 * site logo in the SEO settings, a page's share image, an image inside a post body — and would now
 * point at nothing. This rewrites every such address in every text and JSON column, once.
 *
 * Only an address of THIS api is touched: a relative path, at the start of a value or right after a
 * quote, `(`, `=` or whitespace. `https://api.example.com/api/v1` in a blog post about another
 * service, or a webhook URL pointing elsewhere, has a host in front of it and is left exactly as written.
 *
 * Runs once per site, because every site-owned table is behind row-level security and an unscoped
 * update matches none of its rows. Postgres only: it is the one dialect a deployment runs on, and the
 * pattern match needs `regexp_replace`.
 */
export class StoredApiAddressesWithoutVersionMigration extends BaseMigration {
  readonly version = 69;
  readonly name = 'Stored api addresses without version';
  /** The serving release reads both forms until it is replaced, so rewriting under it changes nothing it shows. */
  readonly rollingSafe = true;

  private static readonly TEXT_TYPES = new Set(['text', 'character varying', 'character']);
  private static readonly JSON_TYPES = new Set(['json', 'jsonb']);

  /** `(^|["'(=\s])/api/v<N>/` — the old prefix of a relative address, with what stood before it kept. */
  static pattern(base = ApiVersionUtils.API_BASE_PATH): string {
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `(^|["'(=\\s])${escaped}/v[0-9]+/`;
  }

  async up(db: IDatabaseManager, _sql?: unknown, tenants?: IMigrationTenantScope): Promise<void> {
    if (db.dialect !== 'postgres') return;
    const tables = await StoredApiAddressesWithoutVersionMigration.tables(db);
    const rewriteAll = async (scoped: boolean, rows: string) => {
      for (const table of tables) {
        if (table.scoped !== scoped || (rows && !table.tenanted)) continue;
        await StoredApiAddressesWithoutVersionMigration.rewrite(db, table.name, table.columns, rows);
      }
    };
    // A table without row-level security is shared: one pass reaches every row of it.
    await rewriteAll(false, '');
    // A site-owned table is rewritten in passes that each touch only rows the pass may write: the
    // platform's own (no site) rows unbound, then each site's rows with that site bound. A policy can
    // SHOW a row it will not let the same binding write — a shared row to a site, a site's row to the
    // platform — and one such row fails the whole statement.
    await rewriteAll(true, '"tenant_id" IS NULL');
    if (!tenants) return;
    await tenants.forEachTenant((tenantId) => tenantId
      ? rewriteAll(true, `"tenant_id"::text = '${tenantId.replace(/'/g, "''")}'`)
      : Promise.resolve());
  }

  /**
   * Every table in the current schema that this role may update, with its text and JSON columns, and
   * whether rows belong to a site. A table another role owns and never granted (a hand-made backup copy)
   * is not this platform's data, and updating it would only fail the boot.
   */
  private static async tables(db: IDatabaseManager): Promise<Array<{ name: string; scoped: boolean; tenanted: boolean; columns: Array<{ name: string; json: string }> }>> {
    const result = await db.execute(Sql.raw(
      `SELECT c.relname AS table_name, c.relrowsecurity AS scoped, a.attname AS column_name, format_type(a.atttypid, NULL) AS data_type,
              EXISTS (SELECT 1 FROM pg_attribute t WHERE t.attrelid = c.oid AND t.attname = 'tenant_id' AND NOT t.attisdropped) AS tenanted
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = current_schema()
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
        WHERE c.relkind IN ('r', 'p')
          AND has_table_privilege(c.oid, 'SELECT') AND has_table_privilege(c.oid, 'UPDATE')
        ORDER BY c.relname, a.attnum`,
    ));
    const byTable = new Map<string, { name: string; scoped: boolean; tenanted: boolean; columns: Array<{ name: string; json: string }> }>();
    for (const row of (result?.rows ?? []) as Array<Record<string, unknown>>) {
      const type = String(row.data_type || '').toLowerCase();
      const json = StoredApiAddressesWithoutVersionMigration.JSON_TYPES.has(type) ? type : '';
      if (!json && !StoredApiAddressesWithoutVersionMigration.TEXT_TYPES.has(type)) continue;
      const name = String(row.table_name);
      if (name === SystemConstants.TABLE.MIGRATIONS) continue;
      const table = byTable.get(name) ?? { name, scoped: row.scoped === true, tenanted: row.tenanted === true, columns: [] };
      table.columns.push({ name: String(row.column_name), json });
      byTable.set(name, table);
    }
    return [...byTable.values()];
  }

  /** One statement per table: each matching column rewritten, every other value left as it is; `rows` narrows which rows. */
  private static async rewrite(db: IDatabaseManager, table: string, columns: Array<{ name: string; json: string }>, rows = ''): Promise<void> {
    const pattern = StoredApiAddressesWithoutVersionMigration.pattern().replace(/'/g, "''");
    const base = ApiVersionUtils.API_BASE_PATH.replace(/'/g, "''");
    const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
    const matches = (column: string) => `${column}::text ~ '${pattern}'`;
    const assignments = columns.map(({ name, json }) => {
      const column = quote(name);
      const replaced = `regexp_replace(${column}::text, '${pattern}', '\\1${base}/', 'g')`;
      return `${column} = CASE WHEN ${matches(column)} THEN ${json ? `(${replaced})::${json}` : replaced} ELSE ${column} END`;
    });
    const any = columns.map(({ name }) => matches(quote(name))).join(' OR ');
    const where = rows ? `${rows} AND (${any})` : any;
    await db.execute(Sql.raw(`UPDATE ${quote(table)} SET ${assignments.join(', ')} WHERE ${where}`));
  }
}
