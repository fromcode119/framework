/**
 * The tenant-scoping DDL, in ONE place because it is security-critical and easy to get subtly wrong.
 *
 * Two details are load-bearing, and both were verified against Postgres 15 before this was written:
 *
 * 1. `nullif(current_setting(...), '')` — NOT a bare `current_setting`. `RESET` on a custom GUC in a
 *    session that previously SET it returns `''`, not NULL, so a bare equality makes `'' = ''` TRUE:
 *    a request with no tenant lands in a phantom shared "empty tenant" that is readable AND
 *    writable, and `NOT NULL` does not catch it because an empty string is not null. A connection
 *    pool that issues SET and RESET on release would funnel every stray query into that bucket.
 * 2. `FORCE ROW LEVEL SECURITY` — without it the table OWNER bypasses the policy entirely and reads
 *    every tenant's rows, with `ENABLE` still on and everything looking perfectly healthy.
 */
export class TenantRlsSql {
  static readonly COLUMN = 'tenant_id';
  static readonly SETTING = 'app.tenant_id';

  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  /** The tenant match used by both USING and WITH CHECK. Empty/unset resolves to NULL, never a match. */
  static predicate(): string {
    return `${TenantRlsSql.COLUMN} = ${TenantRlsSql.currentTenantExpression()}`;
  }

  /** Every statement needed to bring one table under tenant isolation, in order. */
  /**
   * Just the COLUMN and its index — the half that is safe on a deployment with no tenants.
   *
   * Adoption needs this separately. It stamps every table that HAS a `tenant_id` column, but on a
   * deployment whose tables predate tenancy the column does not exist yet: `applyTenantIsolation`
   * returns early while tenant mode is off, and the column only arrives on the NEXT boot, after
   * adoption has already run. So adoption stamped nothing in those tables and their rows were left
   * with no owner — measured on a real adoption: 20 rows across 8 tables, invisible to every tenant.
   *
   * The column is nullable with a default that evaluates to NULL outside a tenant, so adding it
   * before there are any tenants changes no behaviour and loses no rows.
   */
  static columnStatementsFor(table: string): string[] {
    const name = TenantRlsSql.assertIdentifier(table);
    return [
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantRlsSql.COLUMN}" TEXT `
        + `DEFAULT ${TenantRlsSql.currentTenantExpression()}`,
      `CREATE INDEX IF NOT EXISTS "${name}_${TenantRlsSql.COLUMN}_idx" ON "${name}" ("${TenantRlsSql.COLUMN}")`,
    ];
  }

  static statementsFor(table: string): string[] {
    const name = TenantRlsSql.assertIdentifier(table);
    const predicate = TenantRlsSql.predicate();
    return [
      // NULLABLE, deliberately. A NOT NULL column whose default evaluates to NULL — which it does
      // during a migration, where no tenant is set — cannot be added to a table that already has
      // rows: Postgres rejects it with "contains null values" and the migration aborts. Greenfield
      // hid this; it would have broken the first migration of a populated database.
      //
      // Nothing is lost by allowing NULL here. The DEFAULT stamps the tenant on every new row, and
      // WITH CHECK rejects a write whose tenant_id does not equal the current tenant — NULL never
      // does. Pre-existing rows keep NULL and are therefore invisible to EVERY tenant: fail-closed,
      // and a signal that those rows still need an owner rather than a silent leak.
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantRlsSql.COLUMN}" TEXT `
        + `DEFAULT ${TenantRlsSql.currentTenantExpression()}`,
      `CREATE INDEX IF NOT EXISTS "${name}_${TenantRlsSql.COLUMN}_idx" ON "${name}" ("${TenantRlsSql.COLUMN}")`,
      `ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY`,
      `ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`,
      // CREATE POLICY has no IF NOT EXISTS, so the drop is what makes re-running this idempotent.
      // Relying on the duplicate-object error code instead is fragile: the driver wraps the pg error,
      // so the code is not where a naive check looks for it.
      `DROP POLICY IF EXISTS "${name}_tenant_isolation" ON "${name}"`,
      `CREATE POLICY "${name}_tenant_isolation" ON "${name}" `
        + `USING (${predicate}) WITH CHECK (${predicate})`,
    ];
  }

  /**
   * Takes one table back OUT of tenant isolation, for a deployment that has no tenants.
   *
   * The `tenant_id` COLUMN is deliberately kept. Dropping it would destroy the ownership of rows
   * that were written while the deployment did have tenants, and this path exists to repair an
   * installation, never to lose anything. Re-applying `statementsFor` later is a no-op on the column
   * and recreates the policy, so the transition works in both directions.
   */
  static removalStatementsFor(table: string, policies: string[]): string[] {
    const name = TenantRlsSql.assertIdentifier(table);
    return [
      ...policies.map((policy) => `DROP POLICY IF EXISTS "${TenantRlsSql.assertIdentifier(policy)}" ON "${name}"`),
      `ALTER TABLE "${name}" NO FORCE ROW LEVEL SECURITY`,
      `ALTER TABLE "${name}" DISABLE ROW LEVEL SECURITY`,
    ];
  }

  /**
   * Every tenant policy currently in place, by table.
   *
   * Matches `_tenant_` anywhere in the name rather than the generic `_tenant_isolation` suffix,
   * because the bespoke ones are not called that: `media` carries four
   * (`media_tenant_select/insert/update/delete`, split because WITH CHECK does not govern DELETE).
   * Matching only the generic name would have left media isolated — and therefore empty — on a
   * deployment that has no tenants at all.
   */
  static isolatedPoliciesStatement(): string {
    return "SELECT tablename, policyname FROM pg_policies "
      + "WHERE policyname LIKE '%\\_tenant\\_%' AND schemaname = current_schema()";
  }

  /**
   * UNIQUE constraints on `table` that do not include the tenant column, and are not what a FOREIGN
   * KEY points at. Each is a rule written for ONE site — "one page per slug" — that on a shared
   * table silently becomes "one page per slug across every customer": the second tenant to want an
   * `/about` page is refused, and an import of a whole site collides on its first category.
   */
  static tenantBlindUniqueConstraintsStatement(): string {
    return 'SELECT c.conname AS "name", '
      + '(SELECT array_agg(a.attname ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord) '
      + ' JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS "columns" '
      + 'FROM pg_constraint c '
      + "WHERE c.contype = 'u' AND c.conrelid = quote_ident($1)::regclass "
      + 'AND NOT EXISTS (SELECT 1 FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k WHERE a.attname = $2) '
      + "AND NOT EXISTS (SELECT 1 FROM pg_constraint f WHERE f.contype = 'f' AND f.conindid = c.conindid)";
  }

  /** Stand-alone UNIQUE indexes (not constraints) on `table` that ignore the tenant column. */
  static tenantBlindUniqueIndexesStatement(): string {
    return 'SELECT i.relname AS "name", '
      + '(SELECT array_agg(a.attname ORDER BY k.ord) FROM unnest(x.indkey::int2[]) WITH ORDINALITY k(attnum, ord) '
      + ' JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = k.attnum) AS "columns" '
      + 'FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid '
      + 'WHERE x.indrelid = quote_ident($1)::regclass AND x.indisunique AND NOT x.indisprimary AND x.indexprs IS NULL AND x.indpred IS NULL '
      + 'AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = x.indexrelid) '
      + 'AND NOT EXISTS (SELECT 1 FROM unnest(x.indkey::int2[]) k JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = k WHERE a.attname = $2)';
  }

  /**
   * The same rule, per tenant: `(cols…, tenant_id)`. Default NULL handling is kept on purpose — a
   * nullable `custom_permalink` must go on allowing many NULL rows inside one tenant, exactly as the
   * single-column constraint did. (`_system_meta` needed NULLS NOT DISTINCT because there a NULL
   * tenant_id IS a value — the platform row; content tables have no such row.)
   */
  static scopeUniqueConstraintStatement(table: string, constraint: string, columns: string[]): string {
    const name = TenantRlsSql.assertIdentifier(table);
    const con = TenantRlsSql.assertIdentifier(constraint);
    const cols = [...columns, TenantRlsSql.COLUMN].map((column) => `"${TenantRlsSql.assertIdentifier(column)}"`).join(', ');
    return `ALTER TABLE "${name}" DROP CONSTRAINT "${con}", ADD CONSTRAINT "${con}" UNIQUE (${cols})`;
  }

  static scopeUniqueIndexStatements(table: string, index: string, columns: string[]): string[] {
    const name = TenantRlsSql.assertIdentifier(table);
    const idx = TenantRlsSql.assertIdentifier(index);
    const cols = [...columns, TenantRlsSql.COLUMN].map((column) => `"${TenantRlsSql.assertIdentifier(column)}"`).join(', ');
    return [`DROP INDEX IF EXISTS "${idx}"`, `CREATE UNIQUE INDEX "${idx}" ON "${name}" (${cols})`];
  }

  /** Assigns rows that predate tenancy to an owner. Never invents one — the caller names the tenant. */
  static backfillStatement(table: string): string {
    const name = TenantRlsSql.assertIdentifier(table);
    return `UPDATE "${name}" SET "${TenantRlsSql.COLUMN}" = $1 WHERE "${TenantRlsSql.COLUMN}" IS NULL`;
  }

  /** Counts rows that predate tenancy and are therefore invisible to every tenant. */
  static unassignedCountStatement(table: string): string {
    const name = TenantRlsSql.assertIdentifier(table);
    return `SELECT count(*)::int AS unassigned FROM "${name}" WHERE "${TenantRlsSql.COLUMN}" IS NULL`;
  }

  /** Parameterised; `false` = session scope, so it survives across statements on a held client. */
  static setTenantStatement(): string {
    return `SELECT set_config('${TenantRlsSql.SETTING}', $1, false)`;
  }

  /**
   * Marks the connection as acting for a PLATFORM ADMIN, which is what permits writing
   * platform-level (tenant-less) settings. Off unless explicitly turned on, and cleared with the
   * tenant, so it can never outlive the request that earned it.
   */
  static setPlatformAdminStatement(): string {
    return "SELECT set_config('app.platform_admin', $1, false)";
  }

  /** Clearing to '' is safe BECAUSE of the nullif guard — '' never matches a policy. */
  static resetTenantStatement(): string {
    return `SELECT set_config('${TenantRlsSql.SETTING}', '', false)`;
  }

  /** Clears the platform-admin marker. Always paired with the tenant reset on release. */
  static resetPlatformAdminStatement(): string {
    return "SELECT set_config('app.platform_admin', 'off', false)";
  }

  /** The current tenant, or NULL when unset OR reset-to-empty. The nullif is the whole point. */
  private static currentTenantExpression(): string {
    return `nullif(current_setting('${TenantRlsSql.SETTING}', true), '')`;
  }

  private static assertIdentifier(name: string): string {
    const trimmed = String(name ?? '').trim();
    if (!TenantRlsSql.IDENTIFIER.test(trimmed)) {
      throw new Error(`TenantRlsSql: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`);
    }
    return trimmed;
  }
}
