import type { TenantPolicySpec } from '@database/tenant/policies/tenant-policy-spec';
import type { IScopedUniqueRules } from '@database/interfaces/scoped-unique-rules.interface';

/**
 * Tenant isolation, as a capability of the driver that implements it.
 *
 * This exists so that NO code outside the owning dialect writes, reads, or executes a tenancy SQL
 * string. Row-level security is Postgres-only — `CREATE POLICY`, `FORCE ROW LEVEL SECURITY`,
 * `set_config` and the `pg_*` catalog have no portable form — and for a long time that SQL sat in a
 * dialect-neutral folder, which had two visible costs: every caller guarded with its own
 * `dialect !== 'postgres'` string compare, and the statements travelled far enough from the driver
 * that a browser build needed an empty stub of them to resolve.
 *
 * Callers that legitimately skip ask `db.supportsTenantIsolation()` ONCE. They never type-check this
 * object: it is always present, and on a driver with no isolation strategy every method REFUSES
 * rather than doing nothing — a no-op would let a caller believe a table is isolated when it is not,
 * which is the failure this whole layer exists to prevent.
 */
export interface ITenantIsolation {
  /**
   * The ownership column and its index — the half that is safe on a deployment with no tenants.
   *
   * Adoption needs this separately: it stamps every table that HAS the column, but on a deployment
   * whose tables predate tenancy the column does not exist yet, so adoption stamped nothing and
   * those rows were left with no owner (measured on a real adoption: 20 rows across 8 tables).
   */
  addTenantColumn(table: string): Promise<void>;

  /** ENABLE + FORCE row-level security and the generic isolation policy. Idempotent. */
  enforceIsolation(table: string): Promise<void>;

  /**
   * Column, index, RLS and policy in one call, for a caller with nothing to do in between.
   * `SchemaManager` deliberately does NOT use this: it counts orphaned rows and scopes unique rules
   * between the two halves, which it can only do before FORCE RLS hides those rows from itself.
   */
  isolateTable(table: string): Promise<void>;

  /**
   * Drops the named policies, NO FORCE, DISABLE — for a deployment that has no tenants, where a
   * policy matches no row and empties the site.
   *
   * The ownership COLUMN is deliberately kept: dropping it would destroy the ownership of rows
   * written while the deployment did have tenants, and this path exists to repair an installation,
   * never to lose anything.
   */
  releaseTable(table: string, policies: string[]): Promise<void>;

  /** Every tenant policy currently in place, by table — the bespoke ones included. */
  listPolicies(): Promise<Array<{ table: string; policy: string }>>;

  /** Applies one policy the generic rule cannot express. Idempotent. */
  applyPolicy(spec: TenantPolicySpec): Promise<void>;

  /**
   * Rewrites every tenant-blind UNIQUE constraint and stand-alone unique index on `table` to
   * `(cols…, tenant_id)`, and reports what it rewrote.
   *
   * A rule written for one site — "one page per slug" — silently becomes "one page per slug across
   * every customer" once the table is shared. Uniques a FOREIGN KEY depends on are left alone.
   */
  scopeUniqueRules(table: string): Promise<IScopedUniqueRules>;

  /** The named primitive, for a migration that already knows the constraint it wrote. */
  scopeUniqueConstraint(table: string, constraint: string, columns: string[]): Promise<void>;

  /** Rows with no owner — invisible to every tenant, so they must be said out loud. */
  countUnassigned(table: string): Promise<number>;

  /** Assigns those rows to `tenantId`. Never invents one — the caller names the tenant. */
  assignUnassigned(table: string, tenantId: string): Promise<number>;
}
