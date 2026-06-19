import type { Pool } from 'mysql2/promise';
import { sql, and, or, like, count as drizzleCount } from 'drizzle-orm';
import { BaseDialect } from '../base-dialect';
import { MysqlColumnNormalizer } from './column-normalizer';

/**
 * MysqlReadOperations - SELECT / count read path for the MySQL manager.
 *
 * Extends BaseDialect so it reuses the exact raw-SQL builders the manager
 * previously used inline — SQL generation stays byte-identical.
 */
export class MysqlReadOperations extends BaseDialect {
  private pool: Pool;
  private drizzle: any;
  private normalizer: MysqlColumnNormalizer;
  public readonly like: any;

  constructor(pool: Pool, drizzle: any, normalizer: MysqlColumnNormalizer, likeOp: any) {
    super();
    this.pool = pool;
    this.drizzle = drizzle;
    this.normalizer = normalizer;
    this.like = likeOp;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const [rows] = await this.pool.execute(sqlStr, values);
    return rows as any[];
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    if (typeof tableOrName === 'string') {
        const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableOrName, where);
        if (joins && joins.length > 0) {
        const { sql: sqlStr, values } = this.buildJoinedSQL(tableOrName, joins, { ...options, where: normalizedWhere });
        const rows = await this.executeRawSelect(sqlStr, values);
        return this.processJoinedRows(rows, joins);
        }

        let query;
        if (columns && Object.keys(columns).length > 0) {
        const selectFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(columns)) {
            if (value) {
            selectFields[key] = sql`${sql.identifier(key)}`;
            }
        }
        query = this.drizzle.select(selectFields).from(sql`${sql.identifier(tableOrName)}`);
        } else {
        query = this.drizzle.select().from(sql`${sql.identifier(tableOrName)}`);
        }

        const allConditions: any[] = [];
        if (normalizedWhere) {
        if (typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype) {
            allConditions.push(...this.buildWhereConditions(normalizedWhere));
        } else {
            allConditions.push(normalizedWhere);
        }
        }
        if (search && search.columns.length > 0 && search.value) {
        const pattern = `%${search.value}%`;
        const likeConditions = search.columns.map((col: string) => like(sql`${sql.identifier(col)}`, pattern));
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

        const [rows] = await query;
        return rows || [];
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

    const [results] = await query;
    return results;
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins } = options;
    const isString = typeof tableOrName === 'string';
    const tableIdentifier = isString ? sql`${sql.identifier(tableOrName)}` : tableOrName;
    const normalizedWhere = isString ? await this.normalizer.normalizeWhereForTable(tableOrName, where) : where;

    let query = this.drizzle.select({ total: drizzleCount() }).from(tableIdentifier);

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const conditions: any[] = [];
    if (normalizedWhere) {
      if (typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype) {
        conditions.push(...this.buildWhereConditions(normalizedWhere));
      } else {
        conditions.push(normalizedWhere);
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [result] = await query;
    return Number(result[0]?.total || 0);
  }
}
