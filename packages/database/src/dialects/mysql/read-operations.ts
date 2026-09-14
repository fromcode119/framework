import type { Pool } from 'mysql2/promise';
import { sql, and, or, like, count as drizzleCount } from 'drizzle-orm';
import { BaseDialect } from '@database/dialects/base-dialect';
import { MysqlColumnNormalizer } from '@database/dialects/mysql/column-normalizer';

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
    return `DATE_FORMAT(${quotedColumn}, '%%Y-%%m-%%d')`;
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const [rows] = await this.pool.execute(sqlStr, values);
    return rows as any[];
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    if (typeof tableOrName === 'string') {
        const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableOrName, where);
        let selectedEverything = false;
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
        // `select()` with no fields renders an EMPTY select list against a raw `from` on this
        // driver — `select  from \`t\``, a syntax error. Since a bare `find(table)` passes no
        // columns, that is most reads on MySQL. The star is spelled out, and the result is executed
        // as raw SQL below so the rows come back keyed by their real column names rather than by
        // this placeholder.
        query = this.drizzle.select({ '*': sql`*` }).from(sql`${sql.identifier(tableOrName)}`);
        selectedEverything = true;
        }

        const allConditions: any[] = [];
        if (normalizedWhere) {
        if (typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype) {
            allConditions.push(...this.buildWhereConditions(normalizedWhere));  // string table — no column map
        } else {
            allConditions.push(normalizedWhere);
        }
        }
        const searchArg = await this.resolveSearchArg(this.normalizer, tableOrName, search);
        if (searchArg) {
        const pattern = `%${searchArg.value}%`;
        const likeConditions = searchArg.columns.map((col: string) => like(this.resolveColumn(col), pattern));
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

        // NOT `const [rows] = await query`. Drizzle's mysql2 `execute()` resolves to
        // `[rows, fields]`, but a SELECT BUILDER resolves to the rows array itself — so destructuring
        // took the FIRST ROW and returned it as if it were the result set. Every `find()` on this
        // driver returned one object instead of an array, which is why `MigrationManager` failed with
        // "executed.map is not a function" the first time MySQL was actually run.
        // Composed by the builder, executed raw: drizzle maps a mapped selection onto ITS keys, which
        // for the star placeholder above would hand every caller `{ '*': ... }` instead of columns.
        if (selectedEverything) {
          const { sql: text, params } = query.toSQL();
          return await this.executeRawSelect(text, params as any[]);
        }

        const rows = await query;
        return Array.isArray(rows) ? rows : [];
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
        allConditions.push(...this.buildWhereConditions(where, tableOrName));
      } else {
        allConditions.push(where);
      }
    }
    if (search && search.columns.length > 0 && search.value) {
      const pattern = `%${search.value}%`;
      const likeConditions = search.columns.map((col: string) =>
        this.like(this.resolveColumn(col, tableOrName), pattern)
      );
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

    // Same as the string-table branch above: a select builder resolves to the rows, not to
    // `[rows, fields]`.
    const results = await query;
    return Array.isArray(results) ? results : [];
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins } = options;
    const isString = typeof tableOrName === 'string';
    const tableIdentifier = isString ? sql`${sql.identifier(tableOrName)}` : tableOrName;
    const normalizedWhere = isString ? await this.normalizer.normalizeWhereForTable(tableOrName, where) : where;

    // `drizzleCount()` renders to nothing against a RAW `from` on this driver — the emitted SQL was
    // `select  from \`t\``, a syntax error, so `count()` never returned a number at all. Spelling the
    // aggregate out keeps it independent of how the builder treats a raw table identifier.
    let query = this.drizzle.select({ total: sql<number>`count(*)`.as('total') }).from(tableIdentifier);

    if (joins && joins.length > 0) {
      for (const join of joins) {
        const joinFn = join.type === 'left' ? query.leftJoin : query.innerJoin;
        query = joinFn.call(query, join.table, join.on);
      }
    }

    const conditions: any[] = [];
    if (normalizedWhere) {
      if (typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype) {
        conditions.push(...this.buildWhereConditions(normalizedWhere, isString ? undefined : tableOrName));
      } else {
        conditions.push(normalizedWhere);
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Same destructuring mistake as `find`, and quieter: `[result]` took the single count ROW, so
    // `result[0]` was undefined and this returned 0 for EVERY table. Nothing errors on a count of
    // zero — it just makes an empty platform out of a full one, which is how `TenantMode` would have
    // read "no tenants" on a MySQL deployment that had them.
    const rows = await query;
    return Number((Array.isArray(rows) ? rows[0] : undefined)?.total || 0);
  }
}
