import type { DatabaseRolePlan } from '@database/roles/database-role-plan';
import type { DatabaseRoleOutcome } from '@database/roles/database-role-outcome';
import type { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ITenantIsolation } from '@database/interfaces/tenant-isolation.interface';
import type { IColumnStats } from '@database/interfaces/column-stats.interface';
import type { ISchemaIntrospection } from '@database/interfaces/schema-introspection.interface';

/**
 * Interface representing a database manager that provides access to Drizzle ORM
 * and high-level CRUD operations.
 */
export interface IDatabaseManager {
  readonly drizzle: any; 
  readonly dialect: string;
  
  // Dialect-aware operators
  readonly like: (column: any, value: any) => any;
  
  // Standard operators (proxied for driver-only usage)
  readonly eq: any;
  readonly ne: any;
  readonly and: any;
  readonly or: any;
  readonly isNull: any;
  readonly isNotNull: any;
  readonly inArray: any;
  readonly desc: any;
  readonly asc: any;

  execute(query: any): Promise<any>;
  /**
   * One parametrized SQL statement, returning its rows. Runs on the SAME connection the manager would
   * use for any other statement — inside a tenant scope that is the held client carrying
   * `app.tenant_id`, so row-level security applies. `execute` with a drizzle `sql` template goes
   * through drizzle's own pool and does NOT, which is why this exists: raw, parametrized, tenant-bound.
   */
  queryRaw(sqlText: string, values?: unknown[]): Promise<Array<Record<string, unknown>>>;

  /**
   * Runs `fn` with every statement it issues bound to `tenantId`. On Postgres this holds one pooled
   * client with `app.tenant_id` set so row-level security applies; on dialects without RLS it is a
   * passthrough. GUARANTEED present — callers call it directly, never type-check for it.
   */
  withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T>;
  /** Run `fn` as a platform admin: no tenant, allowed to write tenant-less platform rows. Dialects without RLS run `fn` as is. */
  withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Runs `fn` once, exclusively, across every process talking to this database, inside one transaction.
   *
   * For a check-then-write that must not race: two API replicas both seeing "no users yet" and both
   * creating a first administrator is the case this exists for. The caller names the thing being
   * guarded and knows nothing about how the driver achieves it — an advisory lock, an immediate write
   * transaction, a named lock — which is what keeps dialect knowledge out of controllers and services.
   *
   * `fn` runs inside a transaction: returning commits, throwing rolls back.
   */
  withExclusiveLock<T>(name: string, fn: () => Promise<T>): Promise<T>;

  /**
   * Makes sure the logins a deployment runs as exist, with the credentials its connection strings name.
   *
   * Called on a privileged BOOTSTRAP connection before the application opens its own, never on the
   * running app's connection — the whole point is that the app's role cannot create roles.
   *
   * Idempotent: an existing role has its password and attributes brought back into line rather than
   * being recreated. A driver with no concept of a login answers `unsupported` instead of throwing,
   * because a database whose boundary is file permissions is a legitimate deployment, not an error.
   */
  provisionRoles(plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome>;

  /**
   * Lets `role` read and write the tables THIS connection owns, including ones created later.
   *
   * Run on the owner connection after migrations, every boot. Separate from `provisionRoles` because it
   * depends on the schema rather than the server: privileges follow the role that created each object,
   * so they have to be reapplied whenever new objects appear, and only the owner can grant them.
   */
  grantRuntimePrivileges(role: string): Promise<DatabaseRoleOutcome>;

  /**
   * Whether this driver can actually isolate tenants. FALSE unless the driver implements a strategy,
   * and a multi-tenant deployment on such a driver refuses to boot (see TenantMode).
   */
  supportsTenantIsolation(): boolean;

  /**
   * The tenant-isolation DDL, executed by the driver that owns it.
   *
   * ALWAYS PRESENT — callers never type-check it (see the no-defensive-`typeof` rule). On a driver
   * with no isolation strategy every method REFUSES rather than doing nothing, so a caller can never
   * be told a table is isolated when it is not. Ask `supportsTenantIsolation()` first if skipping is
   * legitimate.
   *
   * This exists so no code outside the owning dialect writes or executes a tenancy SQL string:
   * row-level security is Postgres-only and has no portable form, so it belongs beside the driver.
   */
  readonly tenantIsolation: ITenantIsolation;

  /**
   * What the database says about its own tables — columns, types, sequences, foreign keys.
   *
   * Core needs the answers to build a tenant export; the SQL that produces them belongs to the
   * driver. A driver that cannot introspect reports nothing rather than throwing.
   */
  readonly introspection: ISchemaIntrospection;

  /**
   * Enforces a UNIQUE that a field DECLARES on a column that already exists.
   *
   * Not tenancy — it is ordinary schema reconciliation, and it reports rather than throws: a table
   * holding duplicates cannot take the constraint, and that is a fact to surface, not a reason to
   * refuse the boot. A driver that cannot answer says `unsupported`.
   */
  ensureDeclaredUnique(table: string, column: string): Promise<SchemaReconcileOutcome>;

  /**
   * Re-keys a table whose `id` was created as TEXT back to an integer primary key.
   *
   * A driver that cannot ALTER a column type in place does nothing — SQLite is the case, and a
   * database carrying the broken shape there has to be re-created. Callers do NOT test the dialect
   * name: the operation belongs to the driver, which is why it is declared here rather than written
   * out by every migration that needs it.
   */
  repairTextIdPrimaryKey(table: string): Promise<void>;

  /**
   * Relaxes a NOT NULL the schema no longer declares.
   *
   * `required: false` was only honoured when the column was CREATED, so changing a field to optional
   * on an existing table did nothing and the database went on refusing writes the admin presents as
   * optional. Relax-only: this never adds a NOT NULL, because tightening needs a value for the rows
   * that are already NULL and inventing one is exactly what this codebase forbids.
   */
  ensureDeclaredNullable(table: string, column: string): Promise<SchemaReconcileOutcome>;
  /** Gives a `created_at`/`updated_at` column its `DEFAULT CURRENT_TIMESTAMP` when it has none. */
  ensureTimestampDefault(table: string, column: string): Promise<SchemaReconcileOutcome>;

  /**
   * How much is in a column — for showing an operator what dropping it would cost.
   *
   * Runs on the CURRENT connection, so on a tenant-scoped table under FORCE row-level security it
   * reports only what that connection can see. A caller that needs the true total counts once per
   * tenant and sums.
   */
  columnStats(table: string, column: string): Promise<IColumnStats>;

  /** Drops a column. IRREVERSIBLE — only ever called after a human approved this exact name. */
  dropColumn(table: string, column: string): Promise<void>;

  /**
   * Marks this connection as the platform's own (migrations, schema sync), permitting writes to
   * deployment-level rows that belong to no tenant. Never called for the request connection.
   */
  markAsPlatformConnection(): void;
  connect(): Promise<void>;
  
  // High-level agnostic API
  find(tableOrName: any, options?: {
    /**
     * Filters, ANDed together. A value is either a LITERAL (equality) or an OPERATOR EXPRESSION
     * whose keys are all operators — `{ createdAt: { gte: from, lte: to } }`, the only way to express
     * a range. Supported operators: eq, ne, gt, gte, lt, lte. An object mixing operator and
     * non-operator keys raises rather than being guessed at.
     */
    where?: any;
    limit?: number;
    offset?: number;
    orderBy?: any;
    columns?: Record<string, boolean>;
    joins?: any[]; // Can be JoinClause[] or Drizzle-style joins
    /**
     * Push a LIKE/ILIKE filter to the DB. columns are OR-ed, ANDed with where.
     * Columns are canonical schema field names and are resolved against the table's real columns;
     * an unresolvable column raises (UnknownColumnError) rather than silently matching, and a
     * malformed option raises rather than being dropped (which would return the whole table).
     */
    search?: { columns: string[]; value: string };
  }): Promise<any[]>;
  
  findOne(tableOrName: any, where: any): Promise<any | null>;
  
  insert(tableOrName: any, data: any): Promise<any>;
  
  update(tableOrName: any, where: any, data: any): Promise<any>;
  
  upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any>;
  
  delete(tableOrName: any, where: any): Promise<boolean>;
  
  groupCount(tableName: string, options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number }): Promise<Array<Record<string, unknown>>>;
  
  count(tableOrName: any, options?: { where?: any; joins?: any[] }): Promise<number>;

  // Schema Management (Agnostic)
  getTables(): Promise<string[]>;
  tableExists(tableName: string): Promise<boolean>;
  getColumns(tableName: string): Promise<string[]>;
  createTable(collection: ISchemaCollection): Promise<void>;
  addColumn(tableName: string, field: ISchemaField): Promise<void>;
  ensureMigrationTable(tableName: string): Promise<void>;
  resetDatabase(): Promise<void>;
}
