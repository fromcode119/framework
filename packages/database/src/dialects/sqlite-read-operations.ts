import Database from 'better-sqlite3';
import { sql, and, or, count as drizzleCount } from 'drizzle-orm';
import { BaseDialect } from './base-dialect';
import { SqliteColumnNormalizer } from './sqlite-column-normalizer';
import { SqliteDateUtils } from './sqlite-date-utils';

/**
 * SqliteReadOperations - SELECT / count read path for the SQLite manager.
 *
 * Extends BaseDialect so it reuses the exact raw-SQL builders (filter, order-by,
 * join) the manager previously used inline — SQL generation stays byte-identical.
 */
export class SqliteReadOperations extends BaseDialect {
  private sqlite: Database.Database;
  private drizzle: any;
  private normalizer: SqliteColumnNormalizer;
  public readonly like: any;

  constructor(sqlite: Database.Database, drizzle: any, normalizer: SqliteColumnNormalizer, like: any) {
    super();
    this.sqlite = sqlite;
    this.drizzle = drizzle;
    this.normalizer = normalizer;
    this.like = like;
  }

  protected override normalizeParamValue(value: any): any {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return SqliteDateUtils.toSafeIsoDate(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    return this.sqlite.prepare(sqlStr).all(...values);
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;
      const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, where);

      if (joins && joins.length > 0) {
        const { sql: sqlStr, values } = this.buildJoinedSQL(tableName, joins, { ...options, where: normalizedWhere });
        const rows = await this.executeRawSelect(sqlStr, values);
        return this.processJoinedRows(rows, joins);
      }

      // Build SELECT column list
      let columnPart = '*';
      if (columns && Object.keys(columns).length > 0) {
        const selected = Object.entries(columns)
          .filter(([, v]) => v)
          .map(([k]) => `"${k}"`);
        if (selected.length > 0) columnPart = selected.join(', ');
      }

      // Use raw SQL for dynamic table names — drizzle.select() without args produces
      // an empty column list ("select  from …") which SQLite rejects
      const searchArg = (search && search.columns?.length > 0 && search.value) ? search : undefined;
      const { sql: whereSql, values } = this.buildRawFilterSQL(normalizedWhere, searchArg);
      let sqlStr = `SELECT ${columnPart} FROM "${tableName}"${whereSql}`;
      if (orderBy) sqlStr += this.buildRawOrderByClause(orderBy);
      if (limit) sqlStr += ` LIMIT ${limit}`;
      if (offset) sqlStr += ` OFFSET ${offset}`;

      return this.executeRawSelect(sqlStr, values);
    }

    // tableOrName is a Drizzle table schema object
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

    const allConditions: any[] = [];
    if (where) {
      if (typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
        allConditions.push(...this.buildWhereConditions(where));
      } else {
        allConditions.push(where);
      }
    }
    if (search && search.columns.length > 0 && search.value) {
      const pattern = `%${search.value}%`;
      const likeConditions = search.columns.map((col: string) => {
          const colObj = typeof tableOrName[col] !== 'undefined' ? tableOrName[col] : sql`${sql.identifier(col)}`;
          return this.like(colObj, pattern);
      });
      allConditions.push(likeConditions.length === 1 ? likeConditions[0] : or(...likeConditions));
    }
    if (allConditions.length > 0) {
      query = query.where(and(...allConditions));
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
    const tableIdentifier = isString ? sql`${sql.identifier(tableOrName)}` : tableOrName;
    const normalizedWhere = isString ? await this.normalizer.normalizeWhereForTable(tableOrName, where) : where;

    // Check if we can use simple raw SQL for performance
    const isPlainWhere = normalizedWhere && typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype;
    const hasJoins = joins && joins.length > 0;

    if (isString && !hasJoins) {
      if (isPlainWhere && Object.keys(normalizedWhere).length > 0) {
        const { sql: whereSql, values } = this.buildRawFilterSQL(normalizedWhere);
        const rawSql = `SELECT COUNT(*) as total FROM "${tableOrName}"${whereSql}`;
        const result = this.sqlite.prepare(rawSql).get(...values) as any;
        return Number(result?.total || 0);
      }
      const rawSql = `SELECT COUNT(*) as total FROM "${tableOrName}"`;
      const result = this.sqlite.prepare(rawSql).get() as any;
      return Number(result?.total || 0);
    }

    // Use Drizzle for complex counts
    let query = this.drizzle.select({ total: drizzleCount() }).from(tableIdentifier);

    if (hasJoins) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const conditions: any[] = [];
    if (normalizedWhere) {
      if (isPlainWhere) {
        conditions.push(...this.buildWhereConditions(normalizedWhere));
      } else {
        conditions.push(normalizedWhere);
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [result] = await query;
    return Number(result?.total || 0);
  }
}
