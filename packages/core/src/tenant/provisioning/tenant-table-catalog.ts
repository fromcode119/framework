import type { IDatabaseManager } from '@fromcode119/database';
import { NamingStrategy, PhysicalTableNameUtils, TableResolver, TenantRlsSql } from '@fromcode119/database';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Which tables hold tenant data on THIS platform, and what they look like.
 *
 * Discovery is the platform's own, not a hand-kept list: on a multi-tenant deployment the tables
 * carrying a tenant policy (`pg_policies`, exactly the set the RLS sweep maintains); on a
 * single-tenant deployment about to adopt itself as tenant #1 — where the sweep has REMOVED every
 * policy — the tables carrying a `tenant_id` column. A list in code would have gone stale the day a
 * plugin added a table, and a table missing from an export is a table silently lost on import.
 *
 * References come from two places, because plugin schemas rarely declare constraints: the
 * database's FOREIGN KEYs, and every `relationship` field of every registered collection.
 */
export class TenantTableCatalog {
  /** The tenant's own configuration rows: not RLS'd (they are what tenancy reads), exported too. */
  static readonly CONFIG_TABLES = [
    SystemConstants.TABLE.TENANT_PLUGINS,
    SystemConstants.TABLE.TENANT_THEMES,
    SystemConstants.TABLE.TENANT_MEMBERSHIPS,
  ];

  /** Carries `tenant_id` but is never data to move: a session belongs to a login, not to a site. */
  private static readonly EXCLUDED = new Set<string>(['_system_sessions', SystemConstants.TABLE.TENANTS, ...TenantTableCatalog.CONFIG_TABLES]);

  constructor(
    private readonly db: IDatabaseManager,
    private readonly collections: Iterable<{ collection: ICollection; pluginSlug: string }> = [],
  ) {}

  /** Tables under a tenant policy right now — the multi-tenant case. */
  async byPolicy(): Promise<TenantTableDescriptor[]> {
    const rows = await this.db.queryRaw(TenantRlsSql.isolatedPoliciesStatement());
    const tables = [...new Set(rows.map((row) => String(row.tablename)))].filter((table) => !TenantTableCatalog.EXCLUDED.has(table));
    return this.describe(tables);
  }

  /** Tables carrying the column, policy or not — the adoption case, and the export of a source that never had policies. */
  async byColumn(): Promise<TenantTableDescriptor[]> {
    const rows = await this.db.queryRaw(
      "SELECT table_name FROM information_schema.columns WHERE column_name = $1 AND table_schema = current_schema()",
      [TenantRlsSql.COLUMN],
    );
    const tables = [...new Set(rows.map((row) => String(row.table_name)))].filter((table) => !TenantTableCatalog.EXCLUDED.has(table));
    return this.describe(tables);
  }

  /** Full descriptors for a named set of tables, in dependency order (a table after the tables it points at). */
  async describe(tables: string[]): Promise<TenantTableDescriptor[]> {
    const wanted = new Set(tables);
    const [columns, serials, foreignKeys, required] = await Promise.all([this.readColumns(tables), this.readSerials(tables), this.readForeignKeys(tables), this.readRequiredColumns(tables)]);
    const schemaReferences = this.schemaReferences(wanted, columns);

    const descriptors = tables.map((table) => {
      const types = columns.get(table) ?? {};
      const references = [...(foreignKeys.get(table) ?? []), ...(schemaReferences.get(table) ?? [])]
        .filter((ref) => Object.prototype.hasOwnProperty.call(types, ref.column));
      return new TenantTableDescriptor(table, types, serials.has(table), serials.get(table) ?? null, TenantTableCatalog.dedupe(references), required.get(table) ?? new Set());
    });
    return TenantTableCatalog.inDependencyOrder(descriptors);
  }

  private async readColumns(tables: string[]): Promise<Map<string, Record<string, string>>> {
    const out = new Map<string, Record<string, string>>();
    if (tables.length === 0) return out;
    const rows = await this.db.queryRaw(
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

  /** table → the columns declared NOT NULL with no default (excluding id/tenant_id, which the inserter always supplies). */
  private async readRequiredColumns(tables: string[]): Promise<Map<string, Set<string>>> {
    const out = new Map<string, Set<string>>();
    if (tables.length === 0) return out;
    const rows = await this.db.queryRaw(
      "SELECT table_name, column_name FROM information_schema.columns "
      + "WHERE table_schema = current_schema() AND is_nullable = 'NO' AND column_default IS NULL "
      + "AND column_name NOT IN ('id', 'tenant_id') AND table_name = ANY($1)",
      [tables],
    );
    for (const row of rows) {
      const table = String(row.table_name);
      const set = out.get(table) ?? new Set<string>();
      set.add(String(row.column_name));
      out.set(table, set);
    }
    return out;
  }

  /** table → sequence name, for every table whose `id` default is a `nextval(...)`. */
  private async readSerials(tables: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (tables.length === 0) return out;
    const rows = await this.db.queryRaw(
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

  private async readForeignKeys(tables: string[]): Promise<Map<string, TenantColumnReference[]>> {
    const out = new Map<string, TenantColumnReference[]>();
    if (tables.length === 0) return out;
    // pg_catalog, NOT information_schema: `constraint_column_usage` lists only constraints on tables the
    // CURRENT ROLE OWNS, and the api runs as the non-owner app role — so it saw no foreign key at all,
    // every table looked independent, and an import inserted `media` before `media_folders`.
    const rows = await this.db.queryRaw(
      'SELECT rel.relname AS table_name, att.attname AS column_name, ref.relname AS target_table '
      + 'FROM pg_constraint con '
      + 'JOIN pg_class rel ON rel.oid = con.conrelid '
      + 'JOIN pg_class ref ON ref.oid = con.confrelid '
      + 'JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace '
      + 'JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey) '
      + "WHERE con.contype = 'f' AND nsp.nspname = current_schema() AND rel.relname = ANY($1)",
      [tables],
    );
    for (const row of rows) {
      const table = String(row.table_name);
      const list = out.get(table) ?? [];
      list.push(new TenantColumnReference(table, String(row.column_name), String(row.target_table), 'fk'));
      out.set(table, list);
    }
    return out;
  }

  /**
   * `relationship` fields → column references. `relationTo` is written three ways in the wild: a
   * framework table (`users`, `media`), a sibling collection of the same plugin (`categories`), or the
   * `@plugin/entity` form. Only single-valued relations are followed: a `hasMany` is stored as JSON.
   */
  private schemaReferences(wanted: Set<string>, columns: Map<string, Record<string, string>>): Map<string, TenantColumnReference[]> {
    const out = new Map<string, TenantColumnReference[]>();
    for (const { collection, pluginSlug } of this.collections) {
      const table = String(collection.tableName || collection.slug || '').trim();
      if (!wanted.has(table)) continue;
      for (const field of collection.fields ?? []) {
        if (field.type !== 'relationship' || !field.relationTo || Array.isArray(field.relationTo) || field.hasMany) continue;
        const column = NamingStrategy.toSnakeCase(field.name);
        if (!columns.get(table)?.[column]) continue;
        const target = TenantTableCatalog.resolveTarget(String(field.relationTo), pluginSlug, columns);
        if (!target) continue;
        const list = out.get(table) ?? [];
        list.push(new TenantColumnReference(table, column, target, 'schema'));
        out.set(table, list);
      }
    }
    return out;
  }

  private static resolveTarget(relationTo: string, pluginSlug: string, known: Map<string, Record<string, string>>): string | null {
    const candidates = [
      TableResolver.resolve(relationTo),
      PhysicalTableNameUtils.create(pluginSlug, relationTo),
      relationTo,
    ].filter((name) => typeof name === 'string' && name.length > 0) as string[];
    // `users` is a target the catalog does not describe (it is global), but the importer remaps it.
    return candidates.find((name) => known.has(name) || name === SystemConstants.TABLE.USERS) ?? null;
  }

  private static dedupe(references: TenantColumnReference[]): TenantColumnReference[] {
    const seen = new Set<string>();
    return references.filter((ref) => {
      const key = `${ref.column}->${ref.targetTable}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Parents before children, so an import can insert in this order and a delete in the reverse. */
  static inDependencyOrder(descriptors: TenantTableDescriptor[]): TenantTableDescriptor[] {
    const byName = new Map(descriptors.map((d) => [d.name, d]));
    const ordered: TenantTableDescriptor[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (name: string): void => {
      if (state.get(name) === 'done') return;
      const descriptor = byName.get(name);
      if (!descriptor) return;
      if (state.get(name) === 'visiting') return; // a cycle: whichever came first goes first
      state.set(name, 'visiting');
      for (const dependency of descriptor.dependsOn) visit(dependency);
      state.set(name, 'done');
      ordered.push(descriptor);
    };
    for (const descriptor of [...descriptors].sort((a, b) => a.name.localeCompare(b.name))) visit(descriptor.name);
    return ordered;
  }

  /** Quotes for the eraser, which has no other reason to know `TenantSql`. */
  static tenantColumn(): string {
    return TenantSql.identifier(TenantRlsSql.COLUMN);
  }
}
