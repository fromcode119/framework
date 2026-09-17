import { IDatabaseManager, TenantColumn } from '@fromcode119/database';
import { TenantBespokePolicies } from '@core/database/tenant-bespoke-policies';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantScopedTables } from '@core/database/tenant-scoped-tables';
import type { Logger } from '@core/logging';

/**
 * Brings every table's row-level security into line with what the deployment currently IS.
 *
 * Runs on every boot rather than once, because the answer changes underneath it: a deployment with
 * no tenants has NOTHING scoped, and creating the first site flips that for every table at once.
 * Reconciling each boot makes those two states one code path instead of a migration nobody re-runs.
 *
 * Split out of `SchemaManager` (485 lines), which otherwise reconciles COLUMNS — types, uniques,
 * nullability, fingerprints. Isolation is a different axis: it decides who may SEE a row rather than
 * what shape the row has, and it is the half where a mistake leaks data instead of rejecting a write.
 */
export class SchemaTenantIsolationService {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly logger: Logger,
  ) {}

  /**
   * Brings EVERY existing tenant-scoped table under isolation, not just the ones synced this boot.
   *
   * `syncCollection` only runs for collections that are actually registered, so a table belonging to
   * a disabled plugin — or one created before tenancy existed — would otherwise stay unscoped and
   * readable by every tenant, with nothing to indicate it. The statements are idempotent, so this is
   * safe to run on every boot.
   */
  async applyTenantIsolationSweep(systemTables: Set<string>): Promise<void> {
    // The capability, ASKED of the driver — not a string compare against its name. Row-level
    // security is the Postgres driver's to own, and a caller that hard-codes the dialect goes stale
    // the moment another driver gains isolation.
    if (!this.db.supportsTenantIsolation()) return;

    // No tenants means nothing to isolate — and a policy left standing here empties the whole site
    // (see `applyTenantIsolation`). Repair rather than skip: an installation that ran an earlier
    // build of this sweep is sitting on policies right now.
    if (!TenantMode.isEnabled()) {
      await this.removeTenantIsolation();
      return;
    }

    const tables = await this.db.getTables();
    for (const table of tables ?? []) {
      const name = String(table);
      await this.applyTenantIsolation(name, { system: systemTables.has(name.toLowerCase()) });
    }

    await this.applyBespokeTenantPolicies();

    // Framework tables whose policy comes from a migration (`people`, `person_catalogs`, the bespoke
    // three) never pass through `applyTenantIsolation`, so their unique rules are scoped here — every
    // table that carries a tenant policy, whichever path gave it one.
    const policed = await this.db.tenantIsolation.listPolicies();
    for (const table of new Set(policed.map((entry) => entry.table))) {
      await this.scopeUniqueConstraints(table);
    }
  }

  /**
   * Re-applies the policies the generic sweep cannot express (media sharing, settings).
   *
   * They were introduced by migrations, and migrations run once — so a deployment whose policies
   * were removed while it had no tenants would come back UNPROTECTED on those three tables the day
   * it gained one. Applying them from the sweep makes both directions self-healing.
   */
  private async applyBespokeTenantPolicies(): Promise<void> {
    for (const spec of TenantBespokePolicies.specs()) {
      await this.db.tenantIsolation.applyPolicy(spec).catch((error: any) => {
        if (SchemaTenantIsolationService.isDuplicateObject(error)) return;
        this.logger.warn(`Bespoke tenant policy for "${spec.table}" failed: ${error?.message || error}`);
      });
    }
  }

  /**
   * Takes a tenant-less deployment back out of tenant isolation.
   *
   * Loud on purpose. Removing row-level security is exactly the kind of thing that must never happen
   * quietly — but the condition is unambiguous (`_system_tenants` is empty, so there is no second
   * customer to protect anyone from), and the alternative is an installation whose site is blank and
   * whose admin cannot save anything. The `tenant_id` columns are kept, so nothing is lost and the
   * next boot with a tenant re-applies the policies.
   */
  private async removeTenantIsolation(): Promise<void> {
    const byTable = new Map<string, string[]>();
    for (const { table, policy } of await this.db.tenantIsolation.listPolicies()) {
      byTable.set(table, [...(byTable.get(table) ?? []), policy]);
    }
    if (byTable.size === 0) return;

    this.logger.warn(
      `Deployment has NO tenants, but ${byTable.size} table(s) still carry tenant isolation. `
      + 'On a tenant-less deployment no tenant is bound to the connection, so those policies match '
      + 'no row: the site reads empty and writes are refused. Removing them (tenant_id columns are '
      + `kept): ${[...byTable.keys()].join(', ')}`,
    );

    for (const [table, policies] of byTable) {
      await this.db.tenantIsolation.releaseTable(table, policies).catch((error: any) => {
        this.logger.warn(`Could not remove tenant isolation from "${table}": ${error?.message || error}`);
      });
    }
  }

  /**
   * Reports every tenant-scoped table holding rows that predate tenancy.
   *
   * `tenant_id` is added NULLABLE so the DDL can be applied to a populated table (a NOT NULL column
   * whose default evaluates to NULL cannot be). Those rows are then invisible to EVERY tenant —
   * fail-closed, which is right, but silent. Data that has become unreachable must be said out loud
   * so an operator can assign it an owner instead of discovering it missing.
   *
   * Must run BEFORE `ENABLE ROW LEVEL SECURITY` for this table — see the call site.
   */
  private async warnAboutUnassignedRows(tableName: string): Promise<void> {
    try {
      const unassigned = await this.db.tenantIsolation.countUnassigned(tableName);
      if (unassigned === 0) return;
      this.logger.warn(
        `${tableName}: ${unassigned} row(s) predate tenancy and have no ${TenantColumn.NAME}, so they `
        + 'will be invisible to every tenant. Assign them an owner or delete them — they are not lost, '
        + 'but nothing can read them.',
      );
    } catch {
      // Diagnostic only; never let counting break a boot.
    }
  }

  /**
   * A UNIQUE rule written for one site must hold PER site once the table is shared.
   *
   * `fcp_cms_pages.slug UNIQUE` meant "one /about per site"; on a shared table it means one /about
   * across every customer — the second tenant is refused, and importing a whole site collides on its
   * first category. Found through the import (T4), it is a T0 gap: every such constraint and
   * stand-alone unique index becomes `(cols…, tenant_id)`. Discovered from the catalog each boot, so a
   * new plugin table is covered the moment it exists; already-scoped rules are not touched again.
   * Uniques a FOREIGN KEY depends on are left alone and named in the log.
   */
  private async scopeUniqueConstraints(tableName: string): Promise<void> {
    const scoped = await this.db.tenantIsolation.scopeUniqueRules(tableName);
    for (const rule of scoped.constraints) {
      this.logger.info(`${tableName}: UNIQUE "${rule.name}" (${rule.columns.join(', ')}) is scoped per tenant.`);
    }
    for (const rule of scoped.indexes) {
      this.logger.info(`${tableName}: UNIQUE INDEX "${rule.name}" (${rule.columns.join(', ')}) is scoped per tenant.`);
    }
  }

  /** Walks the driver's wrapper chain looking for Postgres' duplicate_object code. */
  private static isDuplicateObject(error: any): boolean {
    for (let current = error; current; current = current.cause) {
      if (current.code === '42710') return true;
    }
    return false;
  }

  /**
   * NOTHING IS SCOPED ON A DEPLOYMENT THAT HAS NO TENANTS, and that is the difference between a
   * working installation and an empty one.
   *
   * The policy is `tenant_id = nullif(current_setting('app.tenant_id', true), '')`. A single-tenant
   * deployment never binds a tenant to the connection — there is none to bind — so on the request
   * role (`fromcode_app`, non-owner, under FORCE RLS) that predicate is NULL for every row. Proven
   * against Postgres 15 on an isolated table carrying one pre-existing row:
   *
   *     SELECT count(*) FROM probe;   -- 0 of 1
   *     INSERT INTO probe (title) ...  -- ERROR: new row violates row-level security policy
   *
   * So applying this unconditionally does not merely hide old rows: it empties every page, product
   * and order on the site AND makes creating new ones impossible. The earlier single-tenant check
   * missed it because it ran against a FRESH database, where "no rows" and "all rows hidden" are the
   * same observation.
   *
   * A policy that has to be bypassed on every request is worse than no policy, so a deployment with
   * no tenants gets no policy. Adding the first tenant already requires a restart (see `TenantMode`),
   * and that restart is what runs this sweep for real.
   */
  async applyTenantIsolation(tableName: string, options: { system?: boolean } = {}): Promise<void> {
    if (!this.db.supportsTenantIsolation()) return;
    if (!TenantMode.isEnabled()) return;
    if (!TenantScopedTables.isTenantScoped(tableName, options)) return;

    try {
      // The column FIRST, then the diagnostics, then enforcement — and the order is load-bearing.
      // FORCE RLS applies to the table OWNER too, so once it is on even this connection cannot see
      // rows with a NULL tenant_id: counting afterwards would report zero for exactly the tables
      // that need reporting. This used to be expressed by looking for 'ENABLE ROW LEVEL SECURITY'
      // inside the statement strings, which only worked while the caller could read the SQL.
      await this.db.tenantIsolation.addTenantColumn(tableName);
      await this.warnAboutUnassignedRows(tableName);
      await this.scopeUniqueConstraints(tableName);
      await this.db.tenantIsolation.enforceIsolation(tableName);
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      // 42710 = duplicate_object. The statements drop the policy first so this should not happen,
      // but the driver wraps the pg error, so the code is checked down the cause chain rather than
      // only on the surface object.
      if (SchemaTenantIsolationService.isDuplicateObject(error)) return;
      this.logger.error(`Failed to apply tenant isolation to ${tableName}: ${error}`);
      throw error;
    }
  }
}
