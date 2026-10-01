import { AggregateStatementBuilder } from '@database/dialects/aggregate-statement-builder';
import type { IAggregateOptions } from '@database/interfaces/aggregate-options.interface';
import Database from 'better-sqlite3';
import { Sql } from '@database/sql/sql';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import type { SqliteTableStatements } from '@database/dialects/sqlite/sqlite-table-statements';
import { BaseDialect } from '@database/dialects/base-dialect';
import { SqliteColumnNormalizer } from '@database/dialects/sqlite/column-normalizer';
import { SqliteDateUtils } from '@database/dialects/sqlite/date-utils';

/**
 * SqliteReadOperations - SELECT / count read path for the SQLite manager.
 *
 * Extends BaseDialect so it reuses the exact raw-SQL builders (filter, order-by,
 * join) the manager previously used inline — SQL generation stays byte-identical.
 */
export class SqliteReadOperations extends BaseDialect {
  private sqlite: Database.Database;
  private statements: SqliteTableStatements;
  private normalizer: SqliteColumnNormalizer;
  public readonly like: any;

  constructor(sqlite: Database.Database, statements: SqliteTableStatements, normalizer: SqliteColumnNormalizer, like: any) {
    super();
    this.sqlite = sqlite;
    this.statements = statements;
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

  /** COUNT(*) per group — see `BaseDialect.buildGroupCountSQL` for the contract. */
  /** Grouped aggregation — see `AggregateStatementBuilder`. */
  async aggregate(tableName: string, options: IAggregateOptions): Promise<Array<Record<string, unknown>>> {
    const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, options.where);
    const { sql: sqlStr, values } = this.aggregateStatements.build(tableName, { ...options, where: normalizedWhere });
    const rows = await this.executeRawSelect(sqlStr, values);
    return (Array.isArray(rows) ? rows : []).map((row: any) => AggregateStatementBuilder.coerceRow(row, options));
  }

  async groupCount(
    tableName: string,
    options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number },
  ): Promise<Array<Record<string, unknown>>> {
    const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, options.where);
    const { sql: sqlStr, values } = this.buildGroupCountSQL(tableName, { ...options, where: normalizedWhere });
    const rows = await this.executeRawSelect(sqlStr, values);
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({ ...row, count: Number(row.count) }));
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
      const searchArg = await this.resolveSearchArg(this.normalizer, tableName, search);
      const { sql: whereSql, values } = this.buildRawFilterSQL(normalizedWhere, searchArg);
      let sqlStr = `SELECT ${columnPart} FROM "${tableName}"${whereSql}`;
      if (orderBy) sqlStr += this.buildRawOrderByClause(orderBy);
      if (limit) sqlStr += ` LIMIT ${limit}`;
      if (offset) sqlStr += ` OFFSET ${offset}`;

      return this.executeRawSelect(sqlStr, values);
    }

    // A declared table.
    const orderExprs = this.buildOrderBy(orderBy);
    const orderList = orderExprs ? (Array.isArray(orderExprs) ? orderExprs : [orderExprs]) : undefined;
    return this.statements.find(tableOrName, { columns, joins, where: this.typedFilter(tableOrName, where, search), orderBy: orderList, limit, offset });
  }

  /** The caller's filter ANDed with the search over the named columns. */
  private typedFilter(table: any, where: any, search: any): any {
    let match: any;
    if (search && search.columns.length > 0 && search.value) {
      const pattern = `%${search.value}%`;
      const matches = search.columns.map((column: string) => this.like(this.resolveColumn(column, table), pattern));
      match = matches.length === 1 ? matches[0] : Sql.or(...matches);
    }
    return SqlTableReads.filterWithSearch(this.buildWhereConditions(where, table), where, match);
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins, search } = options;
    const isString = typeof tableOrName === 'string';
    const normalizedWhere = isString ? await this.normalizer.normalizeWhereForTable(tableOrName, where) : where;

    // Check if we can use simple raw SQL for performance
    const isPlainWhere = normalizedWhere && typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype;
    const hasJoins = joins && joins.length > 0;

    if (isString && !hasJoins) {
      // Built by the SAME builder `find` uses, search included, so the total always describes the
      // list beside it. `buildRawFilterSQL` returns an empty clause when there is nothing to filter
      // by, which is the plain COUNT(*) this used to special-case.
      const searchArg = await this.resolveSearchArg(this.normalizer, tableOrName, search);
      const filter = isPlainWhere ? normalizedWhere : undefined;
      const { sql: whereSql, values } = this.buildRawFilterSQL(filter, searchArg);
      if (isPlainWhere || !normalizedWhere) {
        const rawSql = `SELECT COUNT(*) as total FROM "${tableOrName}"${whereSql}`;
        const result = this.sqlite.prepare(rawSql).get(...values) as any;
        return Number(result?.total || 0);
      }
    }

    if (!isString) {
      // The search a `find` applies applies here too — the total describes the list being shown.
      return this.statements.count(tableOrName, { joins, where: this.typedFilter(tableOrName, where, search) });
    }

    // A table by name, with joins or the caller's own SQL fragment as its filter.
    const conditions = isPlainWhere ? this.buildWhereConditions(normalizedWhere) : [];
    const filter = SqlTableReads.filter(conditions, normalizedWhere);
    const table = Sql.identifier(tableOrName);
    const joined = hasJoins ? joins.map((join: any) => Sql.query` ${Sql.raw(join.type === 'left' ? 'left' : 'inner')} join ${typeof join.table === 'string' ? Sql.identifier(join.table) : join.table}${join.on ? Sql.query` on ${join.on}` : undefined}`) : [];
    const [row] = this.statements.all(Sql.query`select count(*) as total from ${table}${Sql.join(joined)}${filter ? Sql.query` where ${filter}` : undefined}`) as any[];
    return Number(row?.total || 0);
  }
}
