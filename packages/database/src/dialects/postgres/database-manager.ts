import { DatabaseRoleOutcome } from '@database/roles/database-role-outcome';
import type { DatabaseRolePlan } from '@database/roles/database-role-plan';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql, eq, and, or, ne, isNull, isNotNull, inArray, desc, asc, ilike } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
import type { ISchemaField } from '@database/interfaces/schema-field.interface';
import { BaseDialect } from '@database/dialects/base-dialect';
import { NamingStrategy } from '@database/naming-strategy';
import { PostgresColumnNormalizer } from '@database/dialects/postgres/column-normalizer';
import { PostgresSchemaBuilder } from '@database/dialects/postgres/schema-builder';
import { PostgresReadOperations } from '@database/dialects/postgres/read-operations';
import { PostgresTimestampPredicate } from '@database/dialects/postgres/timestamp-predicate';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { PostgresTenantSession } from '@database/dialects/postgres/tenant/tenant-session';
import { PostgresTenantIsolation } from '@database/dialects/postgres/tenant/tenant-isolation';
import { PostgresDeclaredUniqueReconciler } from '@database/dialects/postgres/declared-unique-reconciler';
import { PostgresDeclaredNullabilityReconciler } from '@database/dialects/postgres/declared-nullability-reconciler';
import { PostgresTimestampDefaultReconciler } from '@database/dialects/postgres/timestamp-default-reconciler';
import { PostgresPointInTimeColumnReconciler } from '@database/dialects/postgres/point-in-time-column-reconciler';
import { PostgresColumnInspector } from '@database/dialects/postgres/column-inspector';
import { PlatformPool } from '@database/tenant/platform-pool';
import type { IColumnStats } from '@database/interfaces/column-stats.interface';
import type { ITenantIsolation } from '@database/interfaces/tenant-isolation.interface';
import type { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';

import { PostgresRoleProvisioner } from '@database/dialects/postgres/role-provisioner';
import { PostgresTextIdPrimaryKeyRepair } from '@database/dialects/postgres/text-id-primary-key-repair';
import type { ISchemaIntrospection } from '@database/interfaces/schema-introspection.interface';
import { PostgresSchemaIntrospector } from '@database/dialects/postgres/schema-introspector';
import { PostgresCrudOperations } from '@database/dialects/postgres/postgres-crud-operations';

export class PostgresDatabaseManager extends PostgresCrudOperations implements IDatabaseManager {
  protected pool: Pool;

  /**
   * The connection this statement must run on.
   *
   * When a tenant scope is open, the request's HELD client — the one carrying `app.tenant_id`, so
   * row-level security applies. Otherwise the pool. Untenanted callers (migrations, boot, the
   * tenant resolver itself) take the pool path deliberately; they run as the owner and must be able
   * to see across tenants.
   */
  protected get executor(): { query: (text: any, values?: any[]) => Promise<any> } {
    return (TenantConnectionScope.currentClient(this.pool) as any) ?? this.pool;
  }

  /**
   * Drizzle bound to the same connection as `executor`. The pool-wide instance is for untenanted
   * callers only: a Drizzle statement issued INSIDE a scope on the pool would need a second client
   * while the scope holds its own — ten concurrent scopes, ten held clients, and every such
   * statement waits for an eleventh that never comes (the column normalizer had exactly this bug).
   */
  protected get orm(): any {
    const client = TenantConnectionScope.currentClient(this.pool);
    return client ? drizzle(client as any) : this.drizzle;
  }
  public readonly drizzle: any;
  public readonly dialect = 'postgres' as const;
  protected normalizer: PostgresColumnNormalizer;
  protected schemaBuilder: PostgresSchemaBuilder;
  protected reader: PostgresReadOperations;
  private readonly roles = new PostgresRoleProvisioner((sqlText, values) => this.queryRaw(sqlText, values));

  /** Row-level security, on the same connection every other statement of this manager takes. */
  public readonly tenantIsolation: ITenantIsolation =
    new PostgresTenantIsolation((sqlText, values) => this.queryRaw(sqlText, values));

  private readonly declaredUniques =
    new PostgresDeclaredUniqueReconciler((sqlText, values) => this.queryRaw(sqlText, values));

  private readonly declaredNullability =
    new PostgresDeclaredNullabilityReconciler((sqlText, values) => this.queryRaw(sqlText, values));

  private readonly timestampDefaults =
    new PostgresTimestampDefaultReconciler((sqlText, values) => this.queryRaw(sqlText, values));

  private readonly pointInTimeColumns =
    new PostgresPointInTimeColumnReconciler((sqlText, values) => this.queryRaw(sqlText, values));

  private readonly columns =
    new PostgresColumnInspector((sqlText, values) => this.queryRaw(sqlText, values));

  private readonly textIdRepair =
    new PostgresTextIdPrimaryKeyRepair((sqlText, values) => this.queryRaw(sqlText, values));

  public readonly introspection: ISchemaIntrospection =
    new PostgresSchemaIntrospector((sqlText, values) => this.queryRaw(sqlText, values));

  // Standard operators
  public readonly like = ilike;
  public readonly eq = eq;
  public readonly ne = ne;
  public readonly and = and;
  public readonly or = or;
  public readonly isNull = isNull;
  public readonly isNotNull = isNotNull;
  public readonly inArray = inArray;
  public readonly desc = desc;
  public readonly asc = asc;

  constructor(connection: string) {
    super();
    this.pool = new Pool({ connectionString: connection });
    this.drizzle = drizzle(this.pool);
    this.normalizer = new PostgresColumnNormalizer(this.pool);
    this.schemaBuilder = new PostgresSchemaBuilder(this);
    this.reader = new PostgresReadOperations(this.pool, this.drizzle, this.normalizer, this.like);
  }

  /**
   * Every client this pool hands out is marked as acting for the platform, which is what lets the
   * framework write tenant-less rows (schema fingerprints, migration bookkeeping) that no tenant
   * owns. Applied on the POOL's connect event, because the marker is per-connection and a pool
   * hands out many.
   *
   * Only ever called for the DDL connection. The request connection is never marked, so nothing a
   * tenant request does can write platform rows.
   */
  markAsPlatformConnection(): void {
    // The flag is what keeps the promise true after a scope. `connect` fires once per PHYSICAL
    // connection, so a client that had been through any tenant or platform scope came back with the
    // marker cleared and never got it again — every later untenanted platform write on that client
    // was refused. The scope's release reads this and restores the resting state.
    PlatformPool.mark(this.pool);
    this.pool.on('connect', (client: any) => {
      PostgresTenantSession.markPlatformAdmin(client);
    });
  }

  /** Postgres isolates with row-level security; see TenantIsolationSql and DatabaseRoleGuard. */
  supportsTenantIsolation(): boolean {
    return true;
  }

  /** Holds one pooled client with `app.tenant_id` set, so row-level security applies to every
   * statement `fn` issues. See TenantConnectionScope for why this is not `SET LOCAL`. */
  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return TenantConnectionScope.run(this.pool, tenantId, fn);
  }

  /** Reconciles a declared UNIQUE against the Postgres catalog. */
  async ensureDeclaredUnique(table: string, column: string): Promise<SchemaReconcileOutcome> {
    return this.declaredUniques.ensure(table, column);
  }

  /** Re-keys a TEXT `id` back to an integer primary key. Idempotent; see the repair class. */
  async repairTextIdPrimaryKey(table: string): Promise<void> {
    if (!(await this.tableExists(table))) return;
    await this.textIdRepair.repair(table);
  }

  /** Drops a NOT NULL the schema no longer declares. Never adds one. */
  async ensureDeclaredNullable(table: string, column: string): Promise<SchemaReconcileOutcome> {
    return this.declaredNullability.relax(table, column);
  }

  /** Gives a row-timestamp column its `DEFAULT CURRENT_TIMESTAMP` when it has none. Never replaces one. */
  async ensureTimestampDefault(table: string, column: string): Promise<SchemaReconcileOutcome> {
    return this.timestampDefaults.ensure(table, column);
  }

  /** Converts a TEXT date/datetime column to `timestamptz` when every value is ISO-8601. */
  async ensurePointInTimeColumn(table: string, column: string): Promise<SchemaReconcileOutcome> {
    const outcome = await this.pointInTimeColumns.ensure(table, column);
    // The write normalizer caches each table's column types; a converted column must be re-read.
    this.invalidateTableCache(table);
    return outcome;
  }

  /** Counts on THIS connection — under FORCE RLS that is the bound tenant's rows only. */
  async columnStats(table: string, column: string): Promise<IColumnStats> {
    return this.columns.stats(table, column);
  }

  /** Irreversible. Only reached after a platform admin approved this exact table and column. */
  async dropColumn(table: string, column: string): Promise<void> {
    return this.columns.drop(table, column);
  }

  /** Every statement `fn` issues runs untenanted with the platform-admin marker set. See TenantConnectionScope. */
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
    return TenantConnectionScope.runAsPlatformAdmin(this.pool, fn);
  }

  /**
   * A transaction-scoped advisory lock, held on ONE pooled client for the whole of `fn`.
   *
   * `withPlatformAdmin` pins the connection, which is what makes this safe: BEGIN, the lock, the read
   * and the write cannot drift onto different clients. The lock is released by COMMIT or ROLLBACK, so a
   * crash mid-transaction cannot leave it held. A second replica blocks on the lock, then sees the
   * committed row and takes the losing branch.
   */
  async withExclusiveLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.withPlatformAdmin(async () => {
      await this.queryRaw('BEGIN');
      try {
        await this.queryRaw('SELECT pg_advisory_xact_lock(hashtext($1))', [name]);
        const result = await fn();
        await this.queryRaw('COMMIT');
        return result;
      } catch (error) {
        await this.queryRaw('ROLLBACK').catch(() => undefined);
        throw error;
      }
    });
  }

  /** @inheritdoc — delegated to PostgresRoleProvisioner. */
  async provisionRoles(plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome> {
    return this.roles.provisionRoles(plan);
  }

  /** @inheritdoc — delegated to PostgresRoleProvisioner. */
  async grantRuntimePrivileges(role: string): Promise<DatabaseRoleOutcome> {
    return this.roles.grantRuntimePrivileges(role);
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    client.release();
  }

  async execute(query: any): Promise<any> {
    if (typeof query === 'string') {
      return this.executor.query(query);
    }
    return this.orm.execute(query);
  }

  invalidateTableCache(tableName: string): void {
    this.normalizer.invalidateTableCache(tableName);
  }

  private getDynamicTable(tableName: string, columns: string[]): any {
    const tableColumns: Record<string, any> = {};
    for (const col of columns) {
      tableColumns[col] = text(col);
    }
    return pgTable(tableName, tableColumns);
  }

  /**
   * Postgres has no `jsonb LIKE text` operator, so a search over a JSON column (a tags array) raises
   * rather than matching. The cast is a no-op relabel for text/varchar columns — index use included —
   * and is what makes `contains` mean the same thing on every column type.
   */
  protected patternColumnExpression(quotedColumn: string): string {
    return `${quotedColumn}::text`;
  }

  protected drizzlePatternColumn(column: any): any {
    return sql`${column}::text`;
  }

  protected getLikeOperator(): string {
    return 'ILIKE';
  }

  protected equalityColumnExpression(quotedColumn: string, value: any): string {
    return PostgresTimestampPredicate.equalityColumn(quotedColumn, value);
  }

}