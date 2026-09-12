import { TenantRlsSql } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Which tables are tenant-scoped, and the DDL that scopes them.
 *
 * Derived from the table's own NAME rather than a hand-maintained inventory. A hand-listed set goes
 * stale, and a table missing from it is silently GLOBAL — readable by every tenant with nothing to
 * indicate it. Deriving means a new plugin table is scoped the moment it exists.
 *
 * Framework IDENTITY and CONFIGURATION tables (`users`, `_system_*` settings) are deliberately NOT
 * scoped: who can log in where, and which settings a tenant sees, are platform facts. Framework
 * tables holding a tenant's own CONTENT are scoped — see CONTENT_TABLES, which now covers the
 * people tables and redirects as well as media folders.
 */
export class TenantScopedTableDdl {
  /**
   * Framework tables that hold tenant CONTENT rather than platform configuration, and so ARE scoped
   * even though they are `_system_*` or appear in SystemConstants.TABLE. A tenant's media library,
   * its people and its redirects are its own.
   *
   * This list is what makes them SELF-HEALING, and that is why they are here rather than left to the
   * migrations that first scoped them (021 for the people tables, 030 for redirects). Those
   * migrations create the policy once and never run again — but `removeTenantIsolation` drops every
   * `%_tenant_%` policy whenever a deployment has no tenants, migration-owned ones included. A
   * deployment that ran single-tenant on this build therefore lost them permanently, and the sweep
   * restored only what it could derive. Measured on a deployment adopted into multi-tenancy: five
   * tables with a `tenant_id` column and zero policies — `people`, `people_addresses`,
   * `person_relationships` and `person_catalogs` readable by every tenant, and one site's redirects
   * firing on all of them. Both directions now come from this one list, so what the sweep removes it
   * can also put back.
   *
   * The import reads the same fact: `TenantTableCatalog.byPolicy()` finds tenant tables BY POLICY,
   * so an unscoped table is also a table a site cannot be imported into.
   */
  private static readonly CONTENT_TABLES = new Set<string>([
    String(SystemConstants.TABLE.MEDIA_FOLDERS).toLowerCase(),
    String(SystemConstants.TABLE.PEOPLE).toLowerCase(),
    String(SystemConstants.TABLE.PEOPLE_ADDRESSES).toLowerCase(),
    String(SystemConstants.TABLE.PERSON_RELATIONSHIPS).toLowerCase(),
    String(SystemConstants.TABLE.PERSON_CATALOGS).toLowerCase(),
    '_system_redirects',
  ]);

  /**
   * Tables whose policy is written by a migration rather than the generic one.
   *
   * `media` admits shared assets as well as its own (`OR shared IS TRUE`), so the generic policy
   * would be WRONG for it — and because the boot sweep drops and recreates policies, leaving media
   * in the generic path would silently overwrite the sharing rule on every restart.
   */
  private static readonly BESPOKE_POLICY_TABLES = new Set<string>([
    String(SystemConstants.TABLE.MEDIA).toLowerCase(),
  ]);

  private static readonly SYSTEM_TABLES = new Set<string>(
    Object.values(SystemConstants.TABLE)
      .map((table) => String(table).toLowerCase())
      .filter((table) => !TenantScopedTableDdl.CONTENT_TABLES.has(table)),
  );

  static isTenantScoped(table: string, options: { system?: boolean } = {}): boolean {
    const name = String(table ?? '').trim().toLowerCase();
    if (!name) return false;
    if (TenantScopedTableDdl.BESPOKE_POLICY_TABLES.has(name)) return false;
    if (TenantScopedTableDdl.CONTENT_TABLES.has(name)) return true;
    // A collection marked `system: true` is framework configuration, whatever its table is called.
    // The `settings` collection is the worked example: its slug looks like ordinary content, but it
    // is the global settings store. Scoping it would put platform configuration behind a tenant.
    if (options.system === true) return false;
    if (name.startsWith('_system_')) return false;
    if (TenantScopedTableDdl.SYSTEM_TABLES.has(name)) return false;
    return true;
  }

  /** Every statement needed to bring `table` under tenant isolation; empty when it is not scoped. */
  static statementsFor(table: string, options: { system?: boolean } = {}): string[] {
    if (!TenantScopedTableDdl.isTenantScoped(table, options)) return [];
    return TenantRlsSql.statementsFor(table);
  }
}
