import { Pool } from 'pg';
import { sql, and, or, count as drizzleCount } from 'drizzle-orm';
import { BaseDialect } from './base-dialect';
import { NamingStrategy } from '../naming-strategy';
import { PostgresColumnNormalizer } from './postgres-column-normalizer';

/**
 * PostgresReadOperations - SELECT / count read path for the Postgres manager.
 *
 * Extends BaseDialect so it reuses the exact raw-SQL builders the manager
 * previously used inline — SQL generation stays byte-identical.
 */
export class PostgresReadOperations extends BaseDialect {
  private pool: Pool;
  private drizzle: any;
  private normalizer: PostgresColumnNormalizer;
  public readonly like: any;

  constructor(pool: Pool, drizzle: any, normalizer: PostgresColumnNormalizer, like: any) {
    super();
    this.pool = pool;
    this.drizzle = drizzle;
    this.normalizer = normalizer;
    this.like = like;
  }

  protected getLikeOperator(): string {
    return 'ILIKE';
  }

  protected getParamPlaceholder(index: number): string {
    return `$${index}`;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const result = await this.pool.query(sqlStr, values);
    return result.rows;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const query = sql`SELECT count(*) as total FROM information_schema.tables WHERE table_name = ${tableName}`;
    const result: any = await this.drizzle.execute(query);
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

      const { sql: whereClause, values } = this.buildRawFilterSQL(normalizedWhere, search);
      sqlQuery += whereClause;
      sqlQuery += this.buildRawOrderByClause(orderBy);

      if (limit) sqlQuery += ` LIMIT ${limit}`;
      if (offset) sqlQuery += ` OFFSET ${offset}`;

      const result = await this.pool.query(sqlQuery, values);
      return result.rows;
    }

    // Otherwise use Drizzle for typed table objects
    let query: any;

    if (columns && Object.keys(columns).length > 0) {
      const selection: Record<string, any> = {};
      for (const [key, val] of Object.entries(columns)) {
        if (val) selection[key] = (tableOrName as any)[key];
      }
      query = this.drizzle.select(selection).from(tableOrName);
    } else {
      query = this.drizzle.select().from(tableOrName);
    }

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const isPlainWhere = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    const conditions = this.buildWhereConditions(where);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else if (where && (!isPlainWhere || Object.keys(where).length > 0)) {
      query = query.where(where);
    }

    if (search && search.columns.length > 0 && search.value) {
        const pattern = `%${search.value}%`;
        const likeConditions = search.columns.map((col: string) => {
            const colObj = typeof tableOrName[col] !== 'undefined' ? tableOrName[col] : sql`${sql.identifier(col)}`;
            return this.like(colObj, pattern);
        });
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
    const { where, joins } = options;
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

    let query = this.drizzle.select({ total: drizzleCount() }).from(tableIdentifier);

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const isPlainWhere = !!where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype;
    const conditions = this.buildWhereConditions(where);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else if (where && (!isPlainWhere || Object.keys(where).length > 0)) {
      query = query.where(where);
    }

    const [result] = await query;
    return Number(result?.total || 0);
  }
}
