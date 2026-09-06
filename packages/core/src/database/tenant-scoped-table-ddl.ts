import { TenantRlsSql } from '@fromcode119/database';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Which tables are tenant-scoped, and the DDL that scopes them.
 *
 * Derived from the table's own NAME rather than a hand-maintained inventory. A hand-listed set goes
 * stale, and a table missing from it is silently GLOBAL — readable by every tenant with nothing to
 * indicate it. Deriving means a new plugin table is scoped the moment it exists.
 *
 * Framework identity and configuration tables (`_system_*`, `users`, `people`) are deliberately NOT
 * scoped in T0: who can log in where, which settings a tenant sees and which plugins it has are T1
 * and T2 decisions with their own design work. Until then the platform runs one operator across all
 * tenants.
 */
export class TenantScopedTableDdl {
  /**
   * Framework tables that hold tenant CONTENT rather than platform configuration, and so ARE scoped
   * even though they appear in SystemConstants.TABLE. A tenant's media library is its own.
   */
  private static readonly CONTENT_TABLES = new Set<string>([
    String(SystemConstants.TABLE.MEDIA_FOLDERS).toLowerCase(),
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
