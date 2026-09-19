import { TenantColumnSource } from '@core/tenant/provisioning/enums/tenant-column-source.enum';
import type { IDatabaseManager } from '@fromcode119/database';
import { NamingStrategy, PhysicalTableNameUtils, TableResolver, TenantColumn } from '@fromcode119/database';
import { CollectionLabelUtils } from '@core/collections/collection-label-utils';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { INestedFieldReference } from '@core/tenant/provisioning/interfaces/nested-field-reference.interface';
import { FieldType } from '@core/enums/field-type.enum';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantOwningPluginResolver } from '@core/tenant/provisioning/tenant-owning-plugin-resolver';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';
import { TableVisitState } from '@core/tenant/provisioning/enums/table-visit-state.enum';
import { TenantColumnFold } from '@core/tenant/provisioning/tenant-column-fold';

/**
 * Which tables hold tenant data on THIS platform, and what they look like.
 *
 * It ASKS the driver rather than querying a catalog. This class used to hold five raw
 * `information_schema` / `pg_constraint` statements, which made a CORE class work against exactly
 * one database while presenting itself as neutral — see `ISchemaIntrospection`.
 *
 * Discovery is the platform's own, not a hand-kept list: on a multi-tenant deployment the tables
 * carrying a tenant policy (exactly the set the isolation sweep maintains); on a
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

  /** Always written by the inserter, so never reported as a column a row must supply. */
  private static readonly ALWAYS_SUPPLIED = ['id', TenantColumn.NAME];

  /** Carries `tenant_id` but is never data to move: a session belongs to a login, not to a site. */
  private static readonly EXCLUDED = new Set<string>(['_system_sessions', SystemConstants.TABLE.TENANTS, ...TenantTableCatalog.CONFIG_TABLES]);

  /** Whether this catalog was built WITH collections at all — a CLI process runs no plugin host and passes none. */
  readonly hasSchemaReferences: boolean;

  private readonly collections: Array<{ collection: ICollection; pluginSlug: string }>;

  /**
   * Real plugin slugs known independently of `collections` — a CLI process reads them from the
   * `_system_plugins` table (no plugin host runs there, so `collections` is empty) while the admin
   * has them from `collections` itself. Used ONLY as the fallback below, to longest-prefix-match a
   * physical name against something real rather than trust its naive first-underscore split.
   */
  private readonly knownPluginSlugs: string[];

  constructor(
    private readonly db: IDatabaseManager,
    collections: Iterable<{ collection: ICollection; pluginSlug: string }> = [],
    knownPluginSlugs: Iterable<string> = [],
  ) {
    // Materialized once: `collections` may be a Map's `.values()`, a single-use iterator that a
    // second `for...of` (this class calls `schemaReferences` from `describe`, which callers may
    // invoke more than once against one catalog instance) would silently see as empty.
    this.collections = [...collections];
    this.hasSchemaReferences = this.collections.length > 0;
    this.knownPluginSlugs = [...new Set([...knownPluginSlugs, ...this.collections.map((entry) => entry.pluginSlug)])];
  }

  /** Tables under a tenant policy right now — the multi-tenant case. */
  async byPolicy(): Promise<TenantTableDescriptor[]> {
    const policed = await this.db.tenantIsolation.listPolicies();
    const tables = [...new Set(policed.map((entry) => entry.table))].filter((table) => !TenantTableCatalog.EXCLUDED.has(table));
    return this.describe(tables);
  }

  /** Tables carrying the column, policy or not — the adoption case, and the export of a source that never had policies. */
  async byColumn(): Promise<TenantTableDescriptor[]> {
    const named = await this.db.introspection.tablesWithColumn(TenantColumn.NAME);
    const tables = named.filter((table) => !TenantTableCatalog.EXCLUDED.has(table));
    return this.describe(tables);
  }

  /** Full descriptors for a named set of tables, in dependency order (a table after the tables it points at). */
  async describe(tables: string[]): Promise<TenantTableDescriptor[]> {
    const wanted = new Set(tables);
    const [columns, serials, foreignKeys, required] = await Promise.all([
      this.db.introspection.columnTypes(tables),
      this.db.introspection.serialSequences(tables),
      this.readForeignKeys(tables),
      this.db.introspection.requiredColumns(tables, TenantTableCatalog.ALWAYS_SUPPLIED),
    ]);
    const schemaReferences = this.schemaReferences(wanted, columns);
    const folds = this.schemaFolds(wanted, columns);
    const journals = this.journalTables();
    const owners = this.owners();

    const descriptors = tables.map((table) => {
      const types = columns.get(table) ?? {};
      const references = [...(foreignKeys.get(table) ?? []), ...(schemaReferences.get(table) ?? [])]
        .filter((ref) => Object.prototype.hasOwnProperty.call(types, ref.column));
      const owner = owners.get(table);
      // No collection matched this table — either it is framework-owned (`_system_*`, no plugin at
      // all) or this catalog was built with no collections (the CLI import path runs no plugin host).
      // Longest-prefix match against the REAL slugs this catalog knows recovers the owner without
      // `PhysicalTableNameUtils.parse`'s naive first-underscore split, which is wrong for a
      // multi-token slug (`alpha-beta` truncates to `alpha`). With no real slugs known at
      // all (no collections AND none passed in), that naive split remains the best available guess.
      const pluginSlug = owner?.pluginSlug
        ?? (this.knownPluginSlugs.length > 0
          ? TenantOwningPluginResolver.resolve(table, this.knownPluginSlugs)
          : (PhysicalTableNameUtils.parse(table)?.pluginSlug ?? null));
      const label = owner?.label ?? null;
      return new TenantTableDescriptor(table, types, serials.has(table), serials.get(table) ?? null, TenantTableCatalog.dedupe(references), required.get(table) ?? new Set(), pluginSlug, label, folds.get(table) ?? [], journals.has(table));
    });
    return TenantTableCatalog.inDependencyOrder(descriptors);
  }

  /** Physical table name → owning plugin + human label, from the registered collections (same derivation as `schemaReferences`). */
  private owners(): Map<string, { pluginSlug: string; label: string }> {
    const out = new Map<string, { pluginSlug: string; label: string }>();
    for (const { collection, pluginSlug } of this.collections) {
      const table = String(collection.tableName || collection.slug || '').trim();
      if (!table) continue;
      const shortSlug = String(collection.shortSlug || collection.slug || '').toLowerCase();
      out.set(table, { pluginSlug, label: CollectionLabelUtils.labelFor(collection, shortSlug) });
    }
    return out;
  }

  /** table → references, mapped from the FOREIGN KEYs the driver reports. */
  private async readForeignKeys(tables: string[]): Promise<Map<string, TenantColumnReference[]>> {
    const out = new Map<string, TenantColumnReference[]>();
    for (const key of await this.db.introspection.foreignKeys(tables)) {
      const list = out.get(key.table) ?? [];
      list.push(new TenantColumnReference(key.table, key.column, key.targetTable, TenantColumnSource.FK));
      out.set(key.table, list);
    }
    return out;
  }

  /**
   * `relationship` fields → column references, INCLUDING what is stored as JSON: a `hasMany`
   * relationship (a bare array of ids, or of `{ id }` objects) at the column itself, and a
   * `relationship` sub-field nested below an `array`/`group` field (an array of objects, one key of
   * which is itself a reference — a JSON row's `item` naming another row by id). Walking only the
   * DECLARED shape, never a generic "any integer that matches a remapped id": the schema is what
   * tells an id apart from a quantity or a price, and inventing that rule from the JSON alone would
   * rewrite the wrong ones.
   *
   * `relationTo` is written three ways in the wild: a framework table (`users`, `media`), a sibling
   * collection of the same plugin (a short slug such as `categories`), or the plugin-prefixed form the
   * plugin itself uses for its own slug (`<plugin>-<entity>`, from within that same plugin) —
   * `resolveTarget` tries all three.
   */
  /**
   * Destination columns that ABSORB an older schema's columns, from `IField.legacyColumns`.
   *
   * Read exactly as a relationship is: a generic property on a declared field. The framework learns
   * that some field claims some older column names; it never learns whose. A claim is kept only when
   * the destination column actually exists here and holds JSON — folding eight values into a `text`
   * column would write a shape nothing reads.
   */
  /**
   * Tables whose rows are a record of what happened: the framework's own journals, plus every
   * collection that declares `journal`. Never inferred from a name or a row count — the framework
   * cannot tell a log from a catalogue by looking, and a guess there is magic.
   */
  private journalTables(): Set<string> {
    const out = new Set<string>(TenantBespokePolicies.journalTables());
    for (const { collection } of this.collections) {
      // The collection ALREADY says this, and has since long before the import screen existed: a
      // row an operator can neither create nor edit is a record of what happened, not a thing they
      // manage. Reusing that declaration beats inventing a second one that every plugin would then
      // have to remember to set in agreement with the first.
      if (!(collection.admin?.disableCreate && collection.admin?.disableEdit)) continue;
      const table = String(collection.tableName || collection.slug || '').trim();
      if (table) out.add(table);
    }
    return out;
  }

  private schemaFolds(wanted: Set<string>, columns: Map<string, Record<string, string>>): Map<string, TenantColumnFold[]> {
    const out = new Map<string, TenantColumnFold[]>();
    for (const { collection } of this.collections) {
      const table = String(collection.tableName || collection.slug || '').trim();
      if (!wanted.has(table)) continue;
      for (const field of collection.fields ?? []) {
        const legacy = field.legacyColumns;
        if (!legacy || Object.keys(legacy).length === 0) continue;
        const column = NamingStrategy.toSnakeCase(field.name);
        const type = columns.get(table)?.[column];
        if (!type || !TenantTableDescriptor.isJsonType(type)) continue;
        const existing = out.get(table) ?? [];
        existing.push(new TenantColumnFold(column, { ...legacy }));
        out.set(table, existing);
      }
    }
    return out;
  }

  private schemaReferences(wanted: Set<string>, columns: Map<string, Record<string, string>>): Map<string, TenantColumnReference[]> {
    const out = new Map<string, TenantColumnReference[]>();
    for (const { collection, pluginSlug } of this.collections) {
      const table = String(collection.tableName || collection.slug || '').trim();
      if (!wanted.has(table)) continue;
      for (const field of collection.fields ?? []) {
        const column = NamingStrategy.toSnakeCase(field.name);
        if (!columns.get(table)?.[column]) continue;
        const type = FieldType.resolve(field.type);
        if (type === FieldType.RELATIONSHIP) {
          if (!field.relationTo || Array.isArray(field.relationTo)) continue; // polymorphic: no single target to resolve
          const target = TenantTableCatalog.resolveTarget(String(field.relationTo), pluginSlug, columns);
          if (!target) continue;
          TenantTableCatalog.pushReference(out, new TenantColumnReference(table, column, target, TenantColumnSource.SCHEMA, [], !!field.hasMany, !!field.required));
          continue;
        }
        if ((type === FieldType.ARRAY || type === FieldType.GROUP) && field.fields) {
          for (const nested of TenantTableCatalog.collectNestedReferences(field.fields, [])) {
            const target = TenantTableCatalog.resolveTarget(nested.relationTo, pluginSlug, columns);
            if (!target) continue;
            TenantTableCatalog.pushReference(out, new TenantColumnReference(table, column, target, TenantColumnSource.SCHEMA, nested.path, nested.hasMany, nested.required));
          }
        }
      }
    }
    return out;
  }

  /** Descends `array`/`group` sub-fields looking for a `relationship`, accumulating the JSON path to it. */
  private static collectNestedReferences(fields: IField[], path: string[]): INestedFieldReference[] {
    const out: INestedFieldReference[] = [];
    for (const field of fields) {
      const here = [...path, field.name];
      const type = FieldType.resolve(field.type);
      if (type === FieldType.RELATIONSHIP) {
        if (!field.relationTo || Array.isArray(field.relationTo)) continue;
        out.push({ path: here, relationTo: String(field.relationTo), hasMany: !!field.hasMany, required: !!field.required });
        continue;
      }
      if ((type === FieldType.ARRAY || type === FieldType.GROUP) && field.fields) {
        out.push(...TenantTableCatalog.collectNestedReferences(field.fields, here));
      }
    }
    return out;
  }

  private static pushReference(out: Map<string, TenantColumnReference[]>, ref: TenantColumnReference): void {
    const list = out.get(ref.table) ?? [];
    list.push(ref);
    out.set(ref.table, list);
  }

  /**
   * `relationTo` as a plugin writes it — often its own slug (`<plugin>-<entity>`), which is not a
   * physical table name and not what `PhysicalTableNameUtils.create` would build from it (that
   * doubles the prefix: `fcp_<plugin>_<plugin>_<entity>`). The registry is what turned that same
   * slug into a physical table at registration time, so it is what un-turns it here: the `@plugin/entity`
   * form, entity being `relationTo` with a leading `<pluginSlug>-` stripped when the plugin wrote its
   * own prefix, resolved through `TableResolver` (backed by `PluginRegistry`'s aliases — kebab, camel
   * and snake variants of the entity, or its own default naming when no alias was registered). The
   * older guesses stay as fallbacks for the shapes they were written for; `users` is a target the
   * catalog does not describe (it is global) but the importer remaps it.
   */
  private static resolveTarget(relationTo: string, pluginSlug: string, known: Map<string, Record<string, string>>): string | null {
    const entity = relationTo.startsWith(`${pluginSlug}-`) ? relationTo.slice(pluginSlug.length + 1) : relationTo;
    const candidates = [
      TableResolver.resolve(`@${pluginSlug}/${entity}`),
      TableResolver.resolve(relationTo),
      PhysicalTableNameUtils.create(pluginSlug, relationTo),
      relationTo,
    ].filter((name) => typeof name === 'string' && name.length > 0) as string[];
    return candidates.find((name) => known.has(name) || name === SystemConstants.TABLE.USERS) ?? null;
  }

  private static dedupe(references: TenantColumnReference[]): TenantColumnReference[] {
    const seen = new Set<string>();
    return references.filter((ref) => {
      const key = `${ref.column}[${ref.path.join('.')}]->${ref.targetTable}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Parents before children, so an import can insert in this order and a delete in the reverse. */
  static inDependencyOrder(descriptors: TenantTableDescriptor[]): TenantTableDescriptor[] {
    const byName = new Map(descriptors.map((d) => [d.name, d]));
    const ordered: TenantTableDescriptor[] = [];
    const state = new Map<string, TableVisitState>();
    const visit = (name: string): void => {
      if (state.get(name) === TableVisitState.DONE) return;
      const descriptor = byName.get(name);
      if (!descriptor) return;
      if (state.get(name) === TableVisitState.VISITING) return; // a cycle: whichever came first goes first
      state.set(name, TableVisitState.VISITING);
      for (const dependency of descriptor.dependsOn) visit(dependency);
      state.set(name, TableVisitState.DONE);
      ordered.push(descriptor);
    };
    for (const descriptor of [...descriptors].sort((a, b) => a.name.localeCompare(b.name))) visit(descriptor.name);
    return ordered;
  }

  /** Quotes for the eraser, which has no other reason to know `TenantSql`. */
  static tenantColumn(): string {
    return TenantSql.identifier(TenantColumn.NAME);
  }
}
