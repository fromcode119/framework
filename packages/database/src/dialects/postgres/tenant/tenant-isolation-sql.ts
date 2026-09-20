import { TenantColumn } from '@database/tenant/tenant-column';
import { PostgresTenantPolicyRenderer } from '@database/dialects/postgres/tenant/postgres-tenant-policy-renderer';
import { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import { SqlIdentifier } from '@database/dialects/postgres/sql-identifier';

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
 *
 * INTERNAL to the Postgres dialect. Nothing outside `dialects/postgres/` may import this — callers
 * go through `ITenantIsolation`, which executes rather than handing back strings. It is not exported
 * from the package barrel, and `check:dialect-sql-confinement` fails the build if this SQL reappears
 * elsewhere.
 */
export class TenantIsolationSql {
  static readonly SETTING = 'app.tenant_id';
  static readonly PLATFORM_ADMIN_SETTING = 'app.platform_admin';


  /** The tenant match used by both USING and WITH CHECK. Empty/unset resolves to NULL, never a match. */
  static predicate(): string {
    return `${TenantColumn.NAME} = ${TenantIsolationSql.currentTenantExpression()}`;
  }

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
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    return [
      `ALTER TABLE "${name}" ADD COLUMN IF NOT EXISTS "${TenantColumn.NAME}" TEXT `
        + `DEFAULT ${TenantIsolationSql.currentTenantExpression()}`,
      `CREATE INDEX IF NOT EXISTS "${name}_${TenantColumn.NAME}_idx" ON "${name}" ("${TenantColumn.NAME}")`,
    ];
  }

  /**
   * ENABLE + FORCE row-level security and the generic policy — the half that must NOT run on a
   * deployment with no tenants, because a policy with no tenant bound matches no row.
   *
   * Split from the column half so a caller can do work in between. `SchemaManager` counts orphaned
   * rows and scopes unique rules there: once FORCE RLS is on, even the owner connection cannot see a
   * row with a NULL tenant_id, so the diagnostic would report zero for exactly the tables that need
   * reporting.
   */
  static enforcementStatementsFor(table: string): string[] {
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    const predicate = TenantIsolationSql.predicate();
    return [
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
   * Every statement needed to bring one table under tenant isolation, in order.
   *
   * NULLABLE column, deliberately. A NOT NULL column whose default evaluates to NULL — which it does
   * during a migration, where no tenant is set — cannot be added to a table that already has rows:
   * Postgres rejects it with "contains null values" and the migration aborts. Greenfield hid this;
   * it would have broken the first migration of a populated database.
   *
   * Nothing is lost by allowing NULL. The DEFAULT stamps the tenant on every new row, and WITH CHECK
   * rejects a write whose tenant_id does not equal the current tenant — NULL never does. Pre-existing
   * rows keep NULL and are therefore invisible to EVERY tenant: fail-closed, and a signal that those
   * rows still need an owner rather than a silent leak.
   */
  static statementsFor(table: string): string[] {
    return [
      ...TenantIsolationSql.columnStatementsFor(table),
      ...TenantIsolationSql.enforcementStatementsFor(table),
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
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    return [
      ...policies.map((policy) => `DROP POLICY IF EXISTS "${SqlIdentifier.assert(policy, 'TenantIsolationSql')}" ON "${name}"`),
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
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    const con = SqlIdentifier.assert(constraint, 'TenantIsolationSql');
    const cols = [...columns, TenantColumn.NAME].map((column) => `"${SqlIdentifier.assert(column, 'TenantIsolationSql')}"`).join(', ');
    return `ALTER TABLE "${name}" DROP CONSTRAINT "${con}", ADD CONSTRAINT "${con}" UNIQUE (${cols})`;
  }

  static scopeUniqueIndexStatements(table: string, index: string, columns: string[]): string[] {
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    const idx = SqlIdentifier.assert(index, 'TenantIsolationSql');
    const cols = [...columns, TenantColumn.NAME].map((column) => `"${SqlIdentifier.assert(column, 'TenantIsolationSql')}"`).join(', ');
    return [`DROP INDEX IF EXISTS "${idx}"`, `CREATE UNIQUE INDEX "${idx}" ON "${name}" (${cols})`];
  }

  /**
   * Whether ANY unique constraint or index already covers `column` on `table` — alone, or together
   * with the tenant column.
   *
   * Asked before adding a declared unique to a table that already exists, and both shapes count: an
   * installation that predates tenancy carries the bare `(column)` form, while one that has been
   * through the isolation sweep carries `(column, tenant_id)`. Either already enforces the rule, and
   * adding a second constraint beside it would be noise at best and a conflicting rule at worst.
   */
  static uniqueCoverageStatement(): string {
    return 'SELECT 1 FROM pg_index x '
      + 'WHERE x.indrelid = quote_ident($1)::regclass AND x.indisunique AND x.indexprs IS NULL '
      + 'AND EXISTS (SELECT 1 FROM unnest(x.indkey::int2[]) k JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = k WHERE a.attname = $2) '
      + 'LIMIT 1';
  }

  /**
   * Add a declared unique to a column that already exists.
   *
   * Named the way Postgres names one it creates itself (`<table>_<column>_key`), so a table built
   * fresh and a table reconciled afterwards end up indistinguishable. The isolation sweep then
   * rewrites it to `(column, tenant_id)` in the same pass, exactly as it does for a unique that came
   * from CREATE TABLE.
   */
  static addUniqueConstraintStatement(table: string, column: string): string {
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    const col = SqlIdentifier.assert(column, 'TenantIsolationSql');
    return `ALTER TABLE "${name}" ADD CONSTRAINT "${name}_${col}_key" UNIQUE ("${col}")`;
  }

  /**
   * Makes the ownership column REQUIRED, so an unowned row stops being writable at all.
   *
   * The difference between reporting the fault and preventing it. The column is added nullable — it
   * has to be, to land on a populated table — and its default is the current tenant, which is NULL
   * outside a tenant scope. So an insert made with no site bound wrote a row no site could ever read,
   * and nothing refused it: 20 rows across 8 tables on a live platform, invisible from the moment they
   * were written. With NOT NULL that insert FAILS at the database instead. Row-level security stops a
   * site reading another site's row; this stops a row belonging to nobody being created at all.
   *
   * It is refused while such rows still exist, which is correct — the constraint is the thing that
   * tells you, and the fix is to give those rows an owner or remove them.
   */
  static requireOwnerStatement(table: string): string {
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    return `ALTER TABLE "${name}" ALTER COLUMN "${TenantColumn.NAME}" SET NOT NULL`;
  }

  /** Whether the ownership column is already required — a catalog read, so the ALTER is not re-run every boot. */
  static ownerRequiredStatement(table: string): string {
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    return 'SELECT a.attnotnull AS required FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid '
      + `JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public' AND t.relname = '${name}' `
      + `AND a.attname = '${TenantColumn.NAME}' AND a.attnum > 0 LIMIT 1`;
  }

  /** Assigns rows that predate tenancy to an owner. Never invents one — the caller names the tenant. */
  static backfillStatement(table: string): string {
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    return `UPDATE "${name}" SET "${TenantColumn.NAME}" = $1 WHERE "${TenantColumn.NAME}" IS NULL`;
  }

  /** Counts rows that predate tenancy and are therefore invisible to every tenant. */
  static unassignedCountStatement(table: string): string {
    const name = SqlIdentifier.assert(table, 'TenantIsolationSql');
    return `SELECT count(*)::int AS unassigned FROM "${name}" WHERE "${TenantColumn.NAME}" IS NULL`;
  }

  /**
   * Whether this table's PRIMARY KEY names the ownership column — i.e. whether each site has its own
   * id space here, or they all share one pool of numbers.
   *
   * An import asks this to decide whether it may keep the ids its archive arrives with. It is asked
   * of the live catalog rather than assumed from a migration having run: the migration that widens
   * these keys covers the tables that are tenant-scoped AND carry row-level security, which is most
   * of them and not all of them, and a table it left alone still shares its numbers with every other
   * site.
   *
   * `to_regclass` rather than `::regclass`: a table this deployment does not have answers NULL, and
   * the question is then simply false. The cast would raise instead, which is not an error — it is an
   * answer.
   */
  static perTenantKeyStatement(): string {
    return 'SELECT EXISTS ('
      + 'SELECT 1 FROM pg_index i '
      + `JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attname = '${TenantColumn.NAME}' `
      + 'WHERE i.indrelid = to_regclass(quote_ident($1)) AND i.indisprimary AND a.attnum = ANY(i.indkey)'
      + ') AS keyed';
  }

  /** Parameterised; `false` = session scope, so it survives across statements on a held client. */
  static setTenantStatement(): string {
    return `SELECT set_config('${TenantIsolationSql.SETTING}', $1, false)`;
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
    return `SELECT set_config('${TenantIsolationSql.SETTING}', '', false)`;
  }

  /** Clears the platform-admin marker. Always paired with the tenant reset on release. */
  static resetPlatformAdminStatement(): string {
    return "SELECT set_config('app.platform_admin', 'off', false)";
  }


  /** The current tenant, or NULL when unset OR reset-to-empty. The nullif is the whole point. */
  static currentTenantExpression(): string {
    return `nullif(current_setting('${TenantIsolationSql.SETTING}', true), '')`;
  }


}
