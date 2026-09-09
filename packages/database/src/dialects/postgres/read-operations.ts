import { Pool } from 'pg';
import { sql, and, or, count as drizzleCount } from 'drizzle-orm';
// Aliased: the constructor parameter is also called `drizzle`, and an unaliased import would be
// shadowed by it inside methods — silently resolving to the wrong thing rather than failing.
import { drizzle as createDrizzle } from 'drizzle-orm/node-postgres';
import { BaseDialect } from '@database/dialects/base-dialect';
import { NamingStrategy } from '@database/naming-strategy';
import { PostgresColumnNormalizer } from '@database/dialects/postgres/column-normalizer';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { PostgresTimestampPredicate } from '@database/dialects/postgres/timestamp-predicate';

/**
 * PostgresReadOperations - SELECT / count read path for the Postgres manager.
 *
 * Extends BaseDialect so it reuses the exact raw-SQL builders the manager
 * previously used inline — SQL generation stays byte-identical.
 */
export class PostgresReadOperations extends BaseDialect {
  private pool: Pool;
  private drizzle: any;

  /** Raw statements: the request's held client when a tenant scope is open, else the pool. */
  private get executor(): { query: (text: any, values?: any[]) => Promise<any> } {
    return (TenantConnectionScope.currentClient(this.pool) as any) ?? this.pool;
  }

  /**
   * Drizzle bound to the request's held client when a tenant scope is open, else the pool-wide
   * instance. Without this, Drizzle reads would take an arbitrary pooled connection with no
   * `app.tenant_id` set and return zero rows — RLS failing closed, but on the wrong connection.
   */
  private get orm(): any {
    const client = TenantConnectionScope.currentClient(this.pool);
    return client ? createDrizzle(client as any) : this.drizzle;
  }
  private normalizer: PostgresColumnNormalizer;
  public readonly like: any;

  constructor(pool: Pool, drizzle: any, normalizer: PostgresColumnNormalizer, like: any) {
    super();
    this.pool = pool;
    this.drizzle = drizzle;
    this.normalizer = normalizer;
    this.like = like;
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

  protected getParamPlaceholder(index: number): string {
    return `$${index}`;
  }

  protected equalityColumnExpression(quotedColumn: string, value: any): string {
    return PostgresTimestampPredicate.equalityColumn(quotedColumn, value);
  }

  /** COUNT(*) per group — see `BaseDialect.buildGroupCountSQL` for the contract. */
  async groupCount(
    tableName: string,
    options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number },
  ): Promise<Array<Record<string, unknown>>> {
    const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, options.where);
    const { sql: sqlStr, values } = this.buildGroupCountSQL(tableName, { ...options, where: normalizedWhere });
    const rows = await this.executeRawSelect(sqlStr, values);
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({ ...row, count: Number(row.count) }));
  }

  protected dayBucketExpression(quotedColumn: string): string {
    return `to_char(${quotedColumn}, 'YYYY-MM-DD')`;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const result = await this.executor.query(sqlStr, values);
    return result.rows;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    const result: any = await this.orm.execute(query);
    return (result.rows[0]?.total || 0) > 0;
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    // If it's a string (dynamic table), use raw SQL to ensure all columns are retrieved
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;

      // Guard against querying tables that haven't been created yet (first boot).
      if (!(await this.tableExists(tableName))) {
        return [];
      }

      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, where);

      if (joins && joins.length > 0) {
        const { sql: sqlStr, values } = this.buildJoinedSQL(tableName, joins, { ...options, where: normalizedWhere });
        const rows = await this.executeRawSelect(sqlStr, values);
        return this.processJoinedRows(rows, joins);
      }
      let sqlQuery = `SELECT `;

      if (columns && Object.keys(columns).length > 0) {
        sqlQuery += Object.entries(columns)
          .filter(([_, v]) => v)
          .map(([k, _]) => `"${NamingStrategy.toSnakeCase(k)}"`)
          .join(', ');
      } else {
        sqlQuery += `*`;
      }

      sqlQuery += ` FROM "${tableName}"`;

      const searchArg = await this.resolveSearchArg(this.normalizer, tableName, search);
      const { sql: whereClause, values } = this.buildRawFilterSQL(normalizedWhere, searchArg);
      sqlQuery += whereClause;
      sqlQuery += this.buildRawOrderByClause(orderBy);

      if (limit) sqlQuery += ` LIMIT ${limit}`;
      if (offset) sqlQuery += ` OFFSET ${offset}`;

      const result = await this.executor.query(sqlQuery, values);
      return result.rows;
    }

    // Otherwise use Drizzle for typed table objects
    let query: any;

    if (columns && Object.keys(columns).length > 0) {
      const selection: Record<string, any> = {};
      for (const [key, val] of Object.entries(columns)) {
        if (val) selection[key] = (tableOrName as any)[key];
      }
      query = this.orm.select(selection).from(tableOrName);
    } else {
      query = this.orm.select().from(tableOrName);
    }

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const isPlainWhere = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    const conditions = this.buildWhereConditions(where, tableOrName);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else if (where && (!isPlainWhere || Object.keys(where).length > 0)) {
      query = query.where(where);
    }

    if (search && search.columns.length > 0 && search.value) {
        const pattern = `%${search.value}%`;
        const likeConditions = search.columns.map((col: string) =>
            this.like(this.resolveColumn(col, tableOrName), pattern)
        );
        const searchExpr = likeConditions.length === 1 ? likeConditions[0] : or(...likeConditions);
        query = query.where(searchExpr);
    }

    const orderExprs = this.buildOrderBy(orderBy);
    if (orderExprs) {
      query = query.orderBy(...(Array.isArray(orderExprs) ? orderExprs : [orderExprs]));
    }

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    return await query;
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins, search } = options;
    const isString = typeof tableOrName === 'string';

    // Guard: if given a string table name, skip the query entirely when the
    // table hasn't been created yet (first boot / fresh install).  Without
    // this guard, Postgres emits ERROR-level log entries for every
    // not-yet-synced plugin collection even though the caller catches the
    // exception.
    if (isString && !(await this.tableExists(tableOrName))) {
      return 0;
    }

    const tableIdentifier = isString ? sql`${sql.identifier(tableOrName)}` : tableOrName;

    let query = this.orm.select({ total: drizzleCount() }).from(tableIdentifier);

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    // `buildWhereConditions` resolves each camelCase key via `resolveColumn`, so a schema field like
    // `affiliateCode` reaches the real `affiliate_code` column instead of the non-existent
    // `"affiliateCode"` Postgres would reject (identifiers are quoted case-sensitively). For a string
    // table there is no column map to consult, so pass none and let it snake-case the identifier.
    const normalizedWhere = isString ? await this.normalizer.normalizeWhereForTable(tableOrName, where) : where;
    const isPlainWhere = !!normalizedWhere && typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype;
    const conditions = this.buildWhereConditions(normalizedWhere, isString ? undefined : tableOrName);
    // The same search `find` applied, so the total describes the list the caller is showing.
    const searchCondition = isString
      ? this.drizzleSearchCondition(await this.resolveSearchArg(this.normalizer, tableOrName, search))
      : null;
    if (searchCondition) conditions.push(searchCondition);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else if (normalizedWhere && (!isPlainWhere || Object.keys(normalizedWhere).length > 0)) {
      query = query.where(normalizedWhere);
    }

    const [result] = await query;
    return Number(result?.total || 0);
  }
}
