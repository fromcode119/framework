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
import { TenantRlsSql } from '@database/tenant/tenant-rls-sql';

export class PostgresDatabaseManager extends BaseDialect implements IDatabaseManager {
  private pool: Pool;

  /**
   * The connection this statement must run on.
   *
   * When a tenant scope is open, the request's HELD client — the one carrying `app.tenant_id`, so
   * row-level security applies. Otherwise the pool. Untenanted callers (migrations, boot, the
   * tenant resolver itself) take the pool path deliberately; they run as the owner and must be able
   * to see across tenants.
   */
  private get executor(): { query: (text: any, values?: any[]) => Promise<any> } {
    return (TenantConnectionScope.currentClient(this.pool) as any) ?? this.pool;
  }

  /**
   * Drizzle bound to the same connection as `executor`. The pool-wide instance is for untenanted
   * callers only: a Drizzle statement issued INSIDE a scope on the pool would need a second client
   * while the scope holds its own — ten concurrent scopes, ten held clients, and every such
   * statement waits for an eleventh that never comes (the column normalizer had exactly this bug).
   */
  private get orm(): any {
    const client = TenantConnectionScope.currentClient(this.pool);
    return client ? drizzle(client as any) : this.drizzle;
  }
  public readonly drizzle: any;
  public readonly dialect = 'postgres' as const;
  private normalizer: PostgresColumnNormalizer;
  private schemaBuilder: PostgresSchemaBuilder;
  private reader: PostgresReadOperations;

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
    this.pool.on('connect', (client: any) => {
      client.query(TenantRlsSql.setPlatformAdminStatement(), ['on']).catch(() => undefined);
    });
  }

  /** Postgres isolates with row-level security; see TenantRlsSql and DatabaseRoleGuard. */
  supportsTenantIsolation(): boolean {
    return true;
  }

  /** Holds one pooled client with `app.tenant_id` set, so row-level security applies to every
   * statement `fn` issues. See TenantConnectionScope for why this is not `SET LOCAL`. */
  async withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return TenantConnectionScope.run(this.pool, tenantId, fn);
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

  /**
   * Creates or realigns the deployment's logins.
   *
   * Every identifier and password goes through the server's own `format()` with `%I`/`%L`, so a role
   * name or a password containing a quote is quoted by PostgreSQL rather than by string building here.
   *
   * The attributes are the point of the whole exercise: NOSUPERUSER and NOBYPASSRLS on the runtime role
   * are what make row-level security apply to it at all. A superuser bypasses policies unconditionally
   * and an owner bypasses them on any table missing FORCE — in both cases every query still succeeds
   * and isolation is simply absent, with nothing to notice.
   */
  async provisionRoles(plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome> {
    const roles = plan.isSingleRole ? [plan.owner] : [plan.owner, plan.runtime];

    for (const role of roles) {
      await this.runFormatted(
        'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
        [role.name, role.password],
        'NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)',
      );
      // Always realign an existing role: a password rotated in the connection string has to reach the
      // database, and an attribute someone widened by hand has to come back.
      await this.runFormatted(
        'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
        [role.name, role.password],
      );
      await this.runFormatted('GRANT CONNECT ON DATABASE %I TO %I', [plan.database, role.name]);
    }

    // PostgreSQL 15 removed PUBLIC's CREATE on the `public` schema, so the owner must be granted it
    // explicitly or the very first migration fails with "permission denied for schema public".
    await this.runFormatted('GRANT USAGE, CREATE ON SCHEMA public TO %I', [plan.owner.name]);
    if (!plan.isSingleRole) {
      await this.runFormatted('GRANT USAGE ON SCHEMA public TO %I', [plan.runtime.name]);
    }

    // Table and sequence privileges are deliberately NOT set here: they belong to whoever owns the
    // tables, which is the migration role, and they must be reapplied after every migration rather than
    // once at provisioning time. AppRoleGrantService does that on the owner connection each boot.
    return DatabaseRoleOutcome.applied(roles.map(role => role.name));
  }

  /**
   * Grants the runtime role rights over what this owner has created, and will create.
   *
   * `ON ALL TABLES` covers what exists now; `ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER` covers what
   * this role creates later. Naming CURRENT_USER rather than a configured owner is the point: privileges
   * attach to the role that creates an object, and the deployment's init script used to name the
   * superuser while migrations actually ran as a different role — so every migrated table came out
   * unreadable by the app.
   */
  async grantRuntimePrivileges(role: string): Promise<DatabaseRoleOutcome> {
    await this.runFormatted('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', [role]);
    await this.runFormatted('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', [role]);
    await this.runFormattedWithCurrentUser(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
      role,
    );
    await this.runFormattedWithCurrentUser(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
      role,
    );
    return DatabaseRoleOutcome.applied([role]);
  }

  /** As `runFormatted`, with CURRENT_USER as the first `%I` — the role whose future objects are covered. */
  private async runFormattedWithCurrentUser(template: string, role: string): Promise<void> {
    const rows = await this.queryRaw(
      `SELECT format($f$${template}$f$, CURRENT_USER, $1::text) AS statement`,
      [role],
    );
    const statement = rows?.[0]?.statement;
    if (statement) await this.queryRaw(String(statement));
  }

  /**
   * Builds a DDL statement with the server's own `format()`, then executes what it returned.
   *
   * DDL takes no bind parameters and a `DO $$ … $$` body is an opaque string, so `$1` inside one is not
   * a parameter at all — the driver rejects it with "bind message supplies N parameters, but prepared
   * statement requires 0". Doing it in two steps keeps the quoting where it belongs: `%I` and `%L` are
   * applied by PostgreSQL to bound values, so a role name or password containing a quote is escaped by
   * the server rather than by string building here. `when` is an optional SQL predicate over the same
   * parameters; the statement is produced, and therefore run, only if it holds.
   */
  private async runFormatted(template: string, values: string[], when?: string): Promise<void> {
    const placeholders = values.map((_value, index) => `$${index + 1}::text`).join(', ');
    const rows = await this.queryRaw(
      `SELECT format($f$${template}$f$, ${placeholders}) AS statement${when ? ` WHERE ${when}` : ''}`,
      values,
    );
    const statement = rows?.[0]?.statement;
    if (statement) {
      await this.queryRaw(String(statement));
    }
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

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    return this.reader.find(tableOrName, options);
  }

  async findOne(tableOrName: any, where: any): Promise<any | null> {
    const results = await this.find(tableOrName, { where, limit: 1 });
    return results[0] || null;
  }

  async insert(tableOrName: any, data: any): Promise<any> {
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const columns = Object.keys(data || {});
      if (!columns.length) {
        const result = await this.executor.query(`INSERT INTO "${tableName}" DEFAULT VALUES RETURNING *`);
        return result.rows[0] || null;
      }
      const identifiers = columns.map((column) => `"${NamingStrategy.toSnakeCase(column)}"`).join(', ');
      const placeholders = columns.map((_, index) => this.getParamPlaceholder(index + 1)).join(', ');
      const values = await Promise.all(
        columns.map((column) => this.normalizer.normalizeColumnValueForWrite(tableName, column, data[column]))
      );
      const result = await this.executor.query(
        `INSERT INTO "${tableName}" (${identifiers}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0] || null;
    }
    const [result] = await this.orm.insert(tableOrName).values(data).returning();
    return result;
  }

  async update(tableOrName: any, where: any, data: any): Promise<any> {
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const setColumns = Object.keys(data || {});
      const whereColumns = Object.keys(where || {});
      if (!setColumns.length) throw new Error(`No update fields provided for table "${tableName}"`);
      if (!whereColumns.length) throw new Error(`Unsafe update blocked: missing where clause for table "${tableName}"`);

      const setClause = setColumns.map((column, index) => `"${NamingStrategy.toSnakeCase(column)}" = ${this.getParamPlaceholder(index + 1)}`).join(', ');
      // Equality on a Date operand compares at the driver's read-back precision — see
      // PostgresTimestampPredicate; this is what keeps `update(table, { id, updatedAt }, …)`
      // optimistic locks matching the row they just read.
      const whereClause = whereColumns.map((column, index) => `${this.equalityColumnExpression(`"${NamingStrategy.toSnakeCase(column)}"`, where[column])} = ${this.getParamPlaceholder(setColumns.length + index + 1)}`).join(' AND ');

      const setValues = await Promise.all(
        setColumns.map((column) => this.normalizer.normalizeColumnValueForWrite(tableName, column, data[column]))
      );
      const whereValues = await Promise.all(
        whereColumns.map((column) => this.normalizer.normalizeColumnValueForWrite(tableName, column, where[column]))
      );
      const values = [...setValues, ...whereValues];

      const result = await this.executor.query(`UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause} RETURNING *`, values);
      return result.rows[0] || null;
    }

    const conditions = this.buildWhereConditions(where, tableOrName);
    const [result] = await this.orm
      .update(tableOrName)
      .set(data)
      .where(and(...conditions))
      .returning();
    return result;
  }

  async upsert(tableOrName: any, data: any, options: { target: string | string[]; set: any }): Promise<any> {
    const { target, set } = options;
    const query = this.orm.insert(tableOrName).values(data).onConflictDoUpdate({
      target: typeof target === 'string' ? (tableOrName as any)[target] : target,
      set
    }).returning();
    const [result] = await query;
    return result;
  }

  async delete(tableOrName: any, where: any): Promise<boolean> {
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, where);
      const { sql: whereClause, values } = this.buildRawWhereClause(normalizedWhere);
      if (!whereClause) throw new Error(`Unsafe delete blocked: missing where clause for table "${tableName}"`);

      const result = await this.executor.query(`DELETE FROM "${tableName}"${whereClause} RETURNING *`, values);
      return (result.rowCount || 0) > 0;
    }

    const isPlainWhere = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    const conditions = this.buildWhereConditions(where, tableOrName);
    let query = this.orm.delete(tableOrName);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else if (where && (!isPlainWhere || Object.keys(where).length > 0)) {
      query = query.where(where);
    } else {
      throw new Error('Unsafe delete blocked: missing where clause');
    }
    const result = await query.returning();
    return result.length > 0;
  }

  protected getParamPlaceholder(index: number): string {
    return `$${index}`;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const result = await this.executor.query(sqlStr, values);
    return result.rows;
  }

  async queryRaw(sqlText: string, values: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    const result = await this.executor.query(sqlText, values);
    return (result?.rows ?? []) as Array<Record<string, unknown>>;
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    return this.reader.count(tableOrName, options);
  }

  /** COUNT(*) per group — SQL aggregation, so analytics never page rows into memory to count them. */
  async groupCount(
    tableName: string,
    options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number },
  ): Promise<Array<Record<string, unknown>>> {
    return this.reader.groupCount(tableName, options);
  }

  // Schema Management
  async getTables(): Promise<string[]> {
    const query = sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const result: any = await this.execute(query);
    return result.rows.map((r: any) => r.table_name);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    const result: any = await this.execute(query);
    return (result.rows[0]?.total || 0) > 0;
  }

  async getColumns(tableName: string): Promise<string[]> {
    const result: any = await this.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName}`);
    return result.rows.map((r: any) => r.column_name.toLowerCase());
  }

  async createTable(collection: ISchemaCollection): Promise<void> {
    await this.schemaBuilder.createTable(collection);
  }

  async addColumn(tableName: string, field: ISchemaField): Promise<void> {
    await this.schemaBuilder.addColumn(tableName, field);
  }

  async ensureMigrationTable(tableName: string): Promise<void> {
    await this.schemaBuilder.ensureMigrationTable(tableName);
  }

  async resetDatabase(): Promise<void> {
    await this.execute(sql`DROP SCHEMA public CASCADE`);
    await this.execute(sql`CREATE SCHEMA public`);
  }
}
