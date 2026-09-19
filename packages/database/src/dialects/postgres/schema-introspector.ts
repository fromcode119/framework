import type { IForeignKeyReference } from '@database/interfaces/foreign-key-reference.interface';
import type { ISchemaIntrospection } from '@database/interfaces/schema-introspection.interface';
import type { ISqlRunner } from '@database/interfaces/sql-runner.interface';

/**
 * Reads the Postgres catalog: which tables carry a column, their types, their sequences, their keys.
 *
 * These five queries lived in `TenantTableCatalog`, in CORE. Core is the domain-agnostic layer, so
 * `information_schema` and `pg_constraint` text there meant the tenancy export only ever worked on
 * one driver while claiming to be driver-neutral. The SQL is the driver's; the meaning stays core's.
 *
 * Everything is parameterised — `ANY($1)` over a table array rather than an interpolated list — so
 * no identifier is ever built into these statements.
 */
export class PostgresSchemaIntrospector implements ISchemaIntrospection {
  constructor(private readonly run: ISqlRunner) {}

  async tablesWithColumn(column: string): Promise<string[]> {
    const rows = await this.run(
      'SELECT table_name FROM information_schema.columns WHERE column_name = $1 AND table_schema = current_schema()',
      [column],
    );
    return [...new Set(rows.map((row) => String(row.table_name)))];
  }

  async columnTypes(tables: string[]): Promise<Map<string, Record<string, string>>> {
    const out = new Map<string, Record<string, string>>();
    if (tables.length === 0) return out;
    const rows = await this.run(
      'SELECT table_name, column_name, data_type FROM information_schema.columns '
      + 'WHERE table_schema = current_schema() AND table_name = ANY($1) ORDER BY table_name, ordinal_position',
      [tables],
    );
    for (const row of rows) {
      const table = String(row.table_name);
      const types = out.get(table) ?? {};
      types[String(row.column_name)] = String(row.data_type);
      out.set(table, types);
    }
    return out;
  }

  async requiredColumns(tables: string[], excluding: string[]): Promise<Map<string, Set<string>>> {
    const out = new Map<string, Set<string>>();
    if (tables.length === 0) return out;
    const rows = await this.run(
      'SELECT table_name, column_name FROM information_schema.columns '
      + "WHERE table_schema = current_schema() AND is_nullable = 'NO' AND column_default IS NULL "
      + 'AND NOT (column_name = ANY($2)) AND table_name = ANY($1)',
      [tables, excluding],
    );
    for (const row of rows) {
      const table = String(row.table_name);
      const set = out.get(table) ?? new Set<string>();
      set.add(String(row.column_name));
      out.set(table, set);
    }
    return out;
  }

  async serialSequences(tables: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (tables.length === 0) return out;
    const rows = await this.run(
      "SELECT table_name, pg_get_serial_sequence(quote_ident(table_name), 'id') AS sequence FROM information_schema.columns "
      + "WHERE table_schema = current_schema() AND column_name = 'id' AND table_name = ANY($1) AND column_default LIKE 'nextval(%'",
      [tables],
    );
    for (const row of rows) {
      const sequence = String(row.sequence ?? '').replace(/^public\./, '').replace(/^"|"$/g, '');
      if (sequence) out.set(String(row.table_name), sequence);
    }
    return out;
  }

  /**
   * table → the OTHER columns of a UNIQUE/PRIMARY KEY constraint that already includes
   * `tenantColumn` — the natural key a tenant's own row is identified by, for a table with no
   * serial `id`. `pg_constraint`/`pg_attribute`, for the same non-owner-role reason as `foreignKeys`.
   */
  async naturalKeyColumns(tables: string[], tenantColumn: string): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (tables.length === 0) return out;
    const rows = await this.run(
      'SELECT rel.relname AS table_name, con.conname AS name, '
      + 'array_agg(att.attname ORDER BY k.ord) AS columns '
      + 'FROM pg_constraint con '
      + 'JOIN pg_class rel ON rel.oid = con.conrelid '
      + 'JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace '
      + 'JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true '
      + 'JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum '
      + "WHERE con.contype IN ('u', 'p') AND nsp.nspname = current_schema() AND rel.relname = ANY($1) "
      + 'AND att.attname <> $2 '
      + 'AND EXISTS ('
      + '  SELECT 1 FROM unnest(con.conkey) tenantkey '
      + '  JOIN pg_attribute tenantatt ON tenantatt.attrelid = con.conrelid AND tenantatt.attnum = tenantkey '
      + '  WHERE tenantatt.attname = $2'
      + ') '
      + 'GROUP BY rel.relname, con.conname',
      [tables, tenantColumn],
    );
    for (const row of rows) {
      const table = String(row.table_name);
      const columns = (row.columns as string[] | null) ?? [];
      // A table could carry more than one qualifying constraint; the smallest natural key is the
      // one an upsert should target, and the first one found is kept when sizes tie.
      const existing = out.get(table);
      if (!existing || columns.length < existing.length) out.set(table, columns);
    }
    return out;
  }

  /**
   * pg_catalog, NOT information_schema: `constraint_column_usage` lists only constraints on tables
   * the CURRENT ROLE OWNS, and the api runs as the non-owner app role — so it saw no foreign key at
   * all, every table looked independent, and an import inserted `media` before `media_folders`.
   */
  async foreignKeys(tables: string[]): Promise<IForeignKeyReference[]> {
    if (tables.length === 0) return [];
    const rows = await this.run(
      'SELECT rel.relname AS table_name, att.attname AS column_name, ref.relname AS target_table '
      + 'FROM pg_constraint con '
      + 'JOIN pg_class rel ON rel.oid = con.conrelid '
      + 'JOIN pg_class ref ON ref.oid = con.confrelid '
      + 'JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace '
      + 'JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey) '
      + "WHERE con.contype = 'f' AND nsp.nspname = current_schema() AND rel.relname = ANY($1)",
      [tables],
    );
    return rows.map((row) => ({
      table: String(row.table_name),
      column: String(row.column_name),
      targetTable: String(row.target_table),
    }));
  }
}
