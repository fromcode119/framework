import { SqlIdentifier } from '@database/dialects/postgres/sql-identifier';
import { TenantColumn } from '@database/tenant/tenant-column';
import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';

/**
 * The policies the generic `tenant_id = current_tenant` rule cannot express.
 *
 * Split from `TenantIsolationSql`, which was 430 lines holding two different jobs: the tenancy rule
 * every scoped table gets, and the five exceptions to it. The exceptions are the half that grows —
 * each exists because a specific table broke in a specific way — so they get their own file with the
 * incidents written beside them.
 *
 * FOUR PER-COMMAND POLICIES, not one, wherever reads are widened: `WITH CHECK` does not govern
 * DELETE, so a single `USING (own OR shared)` lets a borrower delete what it can only read.
 */
export class TenantBespokePolicySql {

  /**
   * FOUR policies, one per command, because `WITH CHECK` does not govern DELETE.
   *
   * A single `USING (own OR shared) WITH CHECK (own)` looks right and is not: DELETE falls back to
   * USING, so a borrower could delete another tenant's shared asset out from under them. Sharing
   * must widen READS and nothing else.
   */
  static sharedReadStatements(table: string, sharedColumn: string): string[] {
    const name = SqlIdentifier.assert(table, 'TenantBespokePolicySql');
    const shared = SqlIdentifier.assert(sharedColumn, 'TenantBespokePolicySql');
    const current = TenantIsolationSql.currentTenantExpression();
    const own = `"${TenantColumn.NAME}" = ${current}`;
    const names = [`${name}_tenant_isolation`, `${name}_tenant_select`, `${name}_tenant_insert`,
                   `${name}_tenant_update`, `${name}_tenant_delete`];
    return [
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantColumn.NAME}" TEXT `
        + `DEFAULT ${current}`,
      `CREATE INDEX IF NOT EXISTS "${name}_${TenantColumn.NAME}_idx" ON "${name}" ("${TenantColumn.NAME}")`,
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${shared}" BOOLEAN NOT NULL DEFAULT FALSE`,
      `ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`,
      ...names.map((policy) => `DROP POLICY IF EXISTS "${policy}" ON "${name}"`),
      `CREATE POLICY "${name}_tenant_select" ON "${name}" FOR SELECT USING (${own} OR "${shared}" IS TRUE)`,
      `CREATE POLICY "${name}_tenant_insert" ON "${name}" FOR INSERT WITH CHECK (${own})`,
      `CREATE POLICY "${name}_tenant_update" ON "${name}" FOR UPDATE USING (${own}) WITH CHECK (${own})`,
      `CREATE POLICY "${name}_tenant_delete" ON "${name}" FOR DELETE USING (${own})`,
    ];
  }

  /**
   * Own rows plus UNOWNED ones, readable by all and writable only by their owner.
   *
   * The same four-policy shape as `sharedReadStatements`, and for the same reason: `WITH CHECK` does
   * not govern DELETE, so a single `USING (own OR unowned)` would let any tenant delete every
   * unowned row. Writes are `own` alone, which also means an unowned row cannot be edited or deleted
   * by anyone — correct for a do-not-email entry whose owner is unknown. It is adopted by being
   * stamped, not by being claimed through a policy.
   *
   * NOTE the column default: new rows still stamp the current tenant, so this widens reads for the
   * rows that predate scoping WITHOUT making new rows platform-wide.
   */
  static unownedReadStatements(table: string): string[] {
    const name = SqlIdentifier.assert(table, 'TenantBespokePolicySql');
    const current = TenantIsolationSql.currentTenantExpression();
    const own = `"${TenantColumn.NAME}" = ${current}`;
    const unowned = `"${TenantColumn.NAME}" IS NULL`;
    const names = [`${name}_tenant_isolation`, `${name}_tenant_select`, `${name}_tenant_insert`,
                   `${name}_tenant_update`, `${name}_tenant_delete`];
    return [
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantColumn.NAME}" TEXT `
        + `DEFAULT ${current}`,
      `CREATE INDEX IF NOT EXISTS "${name}_${TenantColumn.NAME}_idx" ON "${name}" ("${TenantColumn.NAME}")`,
      `ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`,
      ...names.map((policy) => `DROP POLICY IF EXISTS "${policy}" ON "${name}"`),
      `CREATE POLICY "${name}_tenant_select" ON "${name}" FOR SELECT USING (${own} OR ${unowned})`,
      `CREATE POLICY "${name}_tenant_insert" ON "${name}" FOR INSERT WITH CHECK (${own})`,
      `CREATE POLICY "${name}_tenant_update" ON "${name}" FOR UPDATE USING (${own}) WITH CHECK (${own})`,
      `CREATE POLICY "${name}_tenant_delete" ON "${name}" FOR DELETE USING (${own})`,
    ];
  }

  /**
   * A tenant sees a platform row only for the deployment truths the caller names, so one key never
   * resolves to two visible rows and `findOne(META, { key })` is unambiguous. The `IS NULL` branch
   * keeps a deployment with no tenants reading all of its own settings.
   */
  static platformKeysVisibleStatements(table: string, keyColumn: string, platformKeys: string[]): string[] {
    const name = SqlIdentifier.assert(table, 'TenantBespokePolicySql');
    const key = SqlIdentifier.assert(keyColumn, 'TenantBespokePolicySql');
    const keys = platformKeys.map((entry) => `'${SqlIdentifier.assertLiteral(entry, 'TenantBespokePolicySql')}'`).join(', ');
    const current = TenantIsolationSql.currentTenantExpression();
    const own = `"${TenantColumn.NAME}" = ${current}`;
    return [
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantColumn.NAME}" TEXT`,
      // The DEFAULT is load-bearing and was missing. Migration 022 added the column without one, so
      // ANY write that did not name a tenant — which is most of them, since callers use
      // `db.insert(META, { key, value })` — landed a NULL, i.e. a PLATFORM row. Under the policy
      // that is refused outright ("new row violates row-level security policy"), which is how
      // enabling a plugin failed while merely reading settings looked perfectly healthy.
      // With the default, a tenant-bound connection writes the tenant's own row, and an untenanted
      // one (boot, single-tenant) still writes the platform row it means to.
      `ALTER TABLE "${name}" ALTER COLUMN "${TenantColumn.NAME}" SET DEFAULT ${current}`,
      `CREATE INDEX IF NOT EXISTS "${name}_tenant_idx" ON "${name}" ("${TenantColumn.NAME}")`,
      `ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "${name}_tenant_isolation" ON "${name}"`,
      `CREATE POLICY "${name}_tenant_isolation" ON "${name}"
         USING (${own} OR ("${TenantColumn.NAME}" IS NULL AND (${current} IS NULL OR "${key}" IN (${keys}))))
         WITH CHECK (
           ${own}
           OR ("${TenantColumn.NAME}" IS NULL AND current_setting('${TenantIsolationSql.PLATFORM_ADMIN_SETTING}', true) = 'on')
         )`,
    ];
  }

  /**
   * A JOURNAL of what happened on a site — the audit trail and the system event log.
   *
   * Two things the generic policy cannot express:
   *
   *   READ — a PLATFORM admin sees everything, but ONLY from the platform scope. The marker is set
   *   deliberately for that read (`db.withPlatformAdmin`), never merely by being untenanted; what is
   *   new is that it no longer overrides a BOUND site. An operator investigating an incident still
   *   cannot be asked to enter each site in turn — they read the whole container from Platform, which
   *   is where that job belongs. Standing inside one site and being shown every other site's journal
   *   is the thing this platform is not allowed to do: measured before the change, a platform admin
   *   bound to one site read another site's log row. Isolation is not conditional on who is asking.
   *
   *   WRITE — an UNTENANTED connection must be able to write, with no marker. Boot, migrations and
   *   platform actions all log before any tenant is bound, and requiring the marker there would
   *   refuse those rows outright — silently losing exactly the entries a journal exists to keep.
   *
   * Rows written before this policy carry NULL and stay visible only to the platform: fail-closed,
   * and an honest signal that their owner is unknown rather than a quiet leak.
   */
  static journalStatements(table: string): string[] {
    const name = SqlIdentifier.assert(table, 'TenantBespokePolicySql');
    const current = TenantIsolationSql.currentTenantExpression();
    const own = `"${TenantColumn.NAME}" = ${current}`;
    const platform = `current_setting('${TenantIsolationSql.PLATFORM_ADMIN_SETTING}', true) = 'on'`;
    return [
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantColumn.NAME}" TEXT DEFAULT ${current}`,
      `ALTER TABLE "${name}" ALTER COLUMN "${TenantColumn.NAME}" SET DEFAULT ${current}`,
      `CREATE INDEX IF NOT EXISTS "${name}_tenant_idx" ON "${name}" ("${TenantColumn.NAME}")`,
      `ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "${name}_tenant_isolation" ON "${name}"`,
      `CREATE POLICY "${name}_tenant_isolation" ON "${name}"
         USING (${own} OR (${platform} AND ${current} IS NULL) OR ("${TenantColumn.NAME}" IS NULL AND ${current} IS NULL))
         WITH CHECK (${own} OR ("${TenantColumn.NAME}" IS NULL AND ${current} IS NULL))`,
    ];
  }

  /** Per tenant with no shared keys: a plugin's configuration is never platform-level. */
  static tenantSettingsStatements(table: string): string[] {
    const name = SqlIdentifier.assert(table, 'TenantBespokePolicySql');
    const current = TenantIsolationSql.currentTenantExpression();
    const own = `"${TenantColumn.NAME}" = ${current}`;
    return [
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantColumn.NAME}" TEXT `
        + `DEFAULT ${current}`,
      `CREATE INDEX IF NOT EXISTS "${name}_tenant_idx" `
        + `ON "${name}" ("${TenantColumn.NAME}")`,
      `ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "${name}_tenant_isolation" ON "${name}"`,
      `CREATE POLICY "${name}_tenant_isolation" ON "${name}"
         USING (${own} OR ("${TenantColumn.NAME}" IS NULL AND ${current} IS NULL))
         WITH CHECK (
           ${own}
           OR ("${TenantColumn.NAME}" IS NULL AND current_setting('${TenantIsolationSql.PLATFORM_ADMIN_SETTING}', true) = 'on')
         )`,
    ];
  }
}
