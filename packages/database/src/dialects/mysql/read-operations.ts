import { AggregateStatementBuilder } from '@database/dialects/aggregate-statement-builder';
import { AggregateBucketUnit } from '@database/enums/aggregate-bucket-unit.enum';
import type { IAggregateOptions } from '@database/interfaces/aggregate-options.interface';
import type { Pool } from 'mysql2/promise';
import { Sql } from '@database/sql/sql';
import { SqlRenderer } from '@database/sql/sql-renderer';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import type { MysqlTableStatements } from '@database/dialects/mysql/mysql-table-statements';
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
  private statements: MysqlTableStatements;
  private normalizer: MysqlColumnNormalizer;
  public readonly like: any;

  constructor(pool: Pool, statements: MysqlTableStatements, normalizer: MysqlColumnNormalizer, likeOp: any) {
    super();
    this.pool = pool;
    this.statements = statements;
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

  /** UTC calendar: MySQL converts zones only with its time-zone tables loaded — see `IAggregateOptions`. */
  protected bucketExpression(quotedColumn: string, unit: AggregateBucketUnit, _timeZone: string): string {
    if (unit === AggregateBucketUnit.HOUR) return `DATE_FORMAT(${quotedColumn}, '%%Y-%%m-%%dT%%H:00')`;
    if (unit === AggregateBucketUnit.WEEK) return `DATE_FORMAT(DATE_SUB(${quotedColumn}, INTERVAL WEEKDAY(${quotedColumn}) DAY), '%%Y-%%m-%%d')`;
    if (unit === AggregateBucketUnit.MONTH) return `DATE_FORMAT(${quotedColumn}, '%%Y-%%m-01')`;
    return `DATE_FORMAT(${quotedColumn}, '%%Y-%%m-%%d')`;
  }

  /** Grouped aggregation — see `AggregateStatementBuilder`. */
  async aggregate(tableName: string, options: IAggregateOptions): Promise<Array<Record<string, unknown>>> {
    const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, options.where);
    const { sql: sqlStr, values } = this.aggregateStatements.build(tableName, { ...options, where: normalizedWhere });
    const rows = await this.executeRawSelect(sqlStr, values);
    return (Array.isArray(rows) ? rows : []).map((row: any) => AggregateStatementBuilder.coerceRow(row, options));
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

        // Named columns are read by their keys; a bare `find` reads every column, keyed by its real name.
        const picked = columns ? Object.entries(columns).filter(([, value]) => value).map(([key]) => key) : [];
        const list = picked.length > 0 ? Sql.join(picked.map((key) => Sql.identifier(key)), Sql.raw(', ')) : Sql.raw('*');

        const allConditions: any[] = [];
        if (normalizedWhere) {
        if (typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype) {
            allConditions.push(...this.buildWhereConditions(normalizedWhere));  // string table — no column map
        } else {
            allConditions.push(normalizedWhere);
        }
        }
        const searchArg = await this.resolveSearchArg(this.normalizer, tableOrName, search);
        if (searchArg) allConditions.push(this.stringSearch(searchArg));
        const filter = Sql.and(...allConditions);
        const orderExprs = this.buildOrderBy(orderBy);
        const orderList = orderExprs ? (Array.isArray(orderExprs) ? orderExprs : [orderExprs]) : [];

        const { text, params } = SqlRenderer.MYSQL.render(Sql.join([
          Sql.query`select ${list} from ${Sql.identifier(tableOrName)}`,
          filter ? Sql.query` where ${filter}` : Sql.empty(),
          orderList.length > 0 ? Sql.query` order by ${Sql.join(orderList, Sql.raw(', '))}` : Sql.empty(),
          limit ? Sql.query` limit ${limit}` : Sql.empty(),
          offset ? Sql.query` offset ${offset}` : Sql.empty(),
        ]));
        if (picked.length === 0) return await this.executeRawSelect(text, params as any[]);
        const rows = await this.statements.arrays(text, params);
        return rows.map((row) => Object.fromEntries(picked.map((key, index) => [key, row[index]])));
    }

    // A declared table.
    const match = this.searchCondition(tableOrName, search);
    const orderExprs = this.buildOrderBy(orderBy);
    const orderList = orderExprs ? (Array.isArray(orderExprs) ? orderExprs : [orderExprs]) : undefined;
    const filter = SqlTableReads.filterWithSearch(this.buildWhereConditions(where, tableOrName), where, match);
    return this.statements.find(tableOrName, { columns, joins, where: filter, orderBy: orderList, limit, offset });
  }

  /** A table-by-name search, already resolved to its real columns. */
  private stringSearch(search: { columns: string[]; value: string }): any {
    const pattern = `%${search.value}%`;
    const matches = search.columns.map((col: string) => Sql.like(this.resolveColumn(col), pattern));
    return matches.length === 1 ? matches[0] : Sql.or(...matches);
  }

  /** The search over named columns, as one condition — or none. A table by name resolves its columns first. */
  private searchCondition(table: any, search: any): any {
    if (!(search && search.columns.length > 0 && search.value)) return undefined;
    const pattern = `%${search.value}%`;
    const matches = search.columns.map((col: string) => this.like(this.resolveColumn(col, typeof table === 'string' ? undefined : table), pattern));
    return matches.length === 1 ? matches[0] : Sql.or(...matches);
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins, search } = options;
    const isString = typeof tableOrName === 'string';
    const normalizedWhere = isString ? await this.normalizer.normalizeWhereForTable(tableOrName, where) : where;
    const isPlain = !!normalizedWhere && typeof normalizedWhere === 'object' && Object.getPrototypeOf(normalizedWhere) === Object.prototype;
    const conditions = isPlain ? this.buildWhereConditions(normalizedWhere, isString ? undefined : tableOrName) : [];
    // The same search `find` applies, so the total describes the list being shown.
    const searchArg = isString ? await this.resolveSearchArg(this.normalizer, tableOrName, search) : search;
    const filter = SqlTableReads.filterWithSearch(conditions, normalizedWhere, isString && searchArg ? this.stringSearch(searchArg) : this.searchCondition(tableOrName, searchArg));
    if (!isString) return this.statements.count(tableOrName, { joins, where: filter });

    const joined = joins && joins.length > 0
      ? joins.map((join: any) => Sql.query` ${Sql.raw(join.type === 'left' ? 'left' : 'inner')} join ${typeof join.table === 'string' ? Sql.identifier(join.table) : join.table}${join.on ? Sql.query` on ${join.on}` : undefined}`)
      : [];
    const [rows] = await this.statements.run(Sql.query`select count(*) as ${Sql.identifier('total')} from ${Sql.identifier(tableOrName)}${Sql.join(joined)}${filter ? Sql.query` where ${filter}` : undefined}`);
    return Number((Array.isArray(rows) ? rows[0] : undefined)?.total || 0);
  }
}
