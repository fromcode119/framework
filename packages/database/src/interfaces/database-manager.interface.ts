import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';

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
   * Whether this driver can actually isolate tenants. FALSE unless the driver implements a strategy,
   * and a multi-tenant deployment on such a driver refuses to boot (see TenantMode).
   */
  supportsTenantIsolation(): boolean;

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
