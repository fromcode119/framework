import { SystemConstants } from '@core/constants/system.constants';

/**
 * WHICH tables are tenant-scoped. The DDL that scopes them belongs to the driver
 * (`db.tenantIsolation`); this class only answers the question.
 *
 * Derived from the table's own NAME rather than a hand-maintained inventory. A hand-listed set goes
 * stale, and a table missing from it is silently GLOBAL — readable by every tenant with nothing to
 * indicate it. Deriving means a new plugin table is scoped the moment it exists.
 *
 * Framework IDENTITY and CONFIGURATION tables (`users`, `_system_*` settings) are deliberately NOT
 * scoped: who can log in where, and which settings a tenant sees, are platform facts. Framework
 * tables holding a tenant's own CONTENT are scoped — see CONTENT_TABLES, which now covers the
 * people tables and redirects as well as media folders.
 *
 * `_system_sessions` is the identity case worth naming, because it HAS a tenant column and is still
 * not here. A session must be readable BEFORE a tenant is bound — that read is what establishes who
 * is asking and therefore which site they may enter — so a policy on it would close the door it is
 * holding open. Its admin surfaces scope themselves, in application code, through `TenantUserScope`.
 * The tenancy registry (`_system_tenants`, `_system_tenant_*`) is unscoped for the same shape of
 * reason: it is the map that answers which sites an account may enter.
 */
export class TenantScopedTables {
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
    // PRIVATE FILE DELIVERY. A share is one site's send of its own files, a grant is one recipient's
    // access to it, and the access log is who opened what. All three are that site's, and none was
    // scoped: the tables carried no `tenant_id` and no policy, while the admin routes that list them
    // query with no filter and are guarded by `admin` — which is what a SITE's own administrator
    // holds. One customer's administrator could therefore list every other customer's private file
    // shares and their recipients.
    //
    // Scoped here rather than in a migration for the reason this whole list exists: a migration
    // writes the policy once, and `removeTenantIsolation` drops it again on any deployment that runs
    // without tenants. From here it is restored on every boot.
    String(SystemConstants.TABLE.FILE_SHARES).toLowerCase(),
    String(SystemConstants.TABLE.FILE_GRANTS).toLowerCase(),
    String(SystemConstants.TABLE.FILE_ACCESS_LOG).toLowerCase(),
    // Preview grants hand out access to a site's UNPUBLISHED content. The column was already there;
    // the policy was not. Generic scoping is right here even though older rows carry no owner: a
    // grant is a short-lived capability, and an unreadable one simply stops working, which is the
    // safe direction for an access token. `_system_notifications` needed the opposite and is a
    // `journal` in TenantBespokePolicies instead — see the note there.
    String(SystemConstants.TABLE.SITE_PREVIEW_GRANTS).toLowerCase(),
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
      .filter((table) => !TenantScopedTables.CONTENT_TABLES.has(table)),
  );

  static isTenantScoped(table: string, options: { system?: boolean } = {}): boolean {
    const name = String(table ?? '').trim().toLowerCase();
    if (!name) return false;
    if (TenantScopedTables.BESPOKE_POLICY_TABLES.has(name)) return false;
    if (TenantScopedTables.CONTENT_TABLES.has(name)) return true;
    // A collection marked `system: true` is framework configuration, whatever its table is called.
    // The `settings` collection is the worked example: its slug looks like ordinary content, but it
    // is the global settings store. Scoping it would put platform configuration behind a tenant.
    if (options.system === true) return false;
    if (name.startsWith('_system_')) return false;
    if (TenantScopedTables.SYSTEM_TABLES.has(name)) return false;
    return true;
  }
}
