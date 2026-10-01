import { AggregateStatementBuilder } from '@database/dialects/aggregate-statement-builder';
import { AggregateBucketUnit } from '@database/enums/aggregate-bucket-unit.enum';
import type { IAggregateOptions } from '@database/interfaces/aggregate-options.interface';
import { Pool } from 'pg';
import { Sql } from '@database/sql/sql';
import { SqlRenderer } from '@database/sql/sql-renderer';
import { SqlTableReads } from '@database/sql/sql-table-reads';
import { BaseDialect } from '@database/dialects/base-dialect';
import { NamingStrategy } from '@database/naming-strategy';
import { PostgresColumnNormalizer } from '@database/dialects/postgres/column-normalizer';
import { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
import { PostgresTimestampPredicate } from '@database/dialects/postgres/timestamp-predicate';
import { PostgresTableStatements } from '@database/dialects/postgres/postgres-table-statements';
import { PostgresKnownTables } from '@database/dialects/postgres/postgres-known-tables';

/**
 * PostgresReadOperations - SELECT / count read path for the Postgres manager.
 *
 * Extends BaseDialect so it reuses the exact raw-SQL builders the manager
 * previously used inline — SQL generation stays byte-identical.
 */
export class PostgresReadOperations extends BaseDialect {
  private pool: Pool;

  /** Raw statements: the request's held client when a tenant scope is open, else the pool. */
  private get executor(): { query: (text: any, values?: any[]) => Promise<any> } {
    return (TenantConnectionScope.currentClient(this.pool) as any) ?? this.pool;
  }
  private normalizer: PostgresColumnNormalizer;
  public readonly like: any;
  private readonly tables = new PostgresKnownTables(() => this.executor);
  private readonly tableStatements = new PostgresTableStatements();

  constructor(pool: Pool, normalizer: PostgresColumnNormalizer, like: any) {
    super();
    this.pool = pool;
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
    return Sql.query`${column}::text`;
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

  /** Truncated in the caller's zone: `timestamptz AT TIME ZONE` gives that zone's wall clock. */
  protected bucketExpression(quotedColumn: string, unit: AggregateBucketUnit, timeZone: string): string {
    const local = `date_trunc('${unit.value}', ${quotedColumn} AT TIME ZONE '${timeZone}')`;
    return unit === AggregateBucketUnit.HOUR ? `to_char(${local}, 'YYYY-MM-DD"T"HH24:00')` : `to_char(${local}, 'YYYY-MM-DD')`;
  }

  /** Grouped aggregation — see `AggregateStatementBuilder`. */
  async aggregate(tableName: string, options: IAggregateOptions): Promise<Array<Record<string, unknown>>> {
    const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableName, options.where);
    const { sql: sqlStr, values } = this.aggregateStatements.build(tableName, { ...options, where: normalizedWhere });
    const rows = await this.executeRawSelect(sqlStr, values);
    return (Array.isArray(rows) ? rows : []).map((row: any) => AggregateStatementBuilder.coerceRow(row, options));
  }

  protected async executeRawSelect(sqlStr: string, values: any[]): Promise<any[]> {
    const result = await this.executor.query(sqlStr, values);
    return result.rows;
  }

  async find(tableOrName: any, options: any = {}): Promise<any[]> {
    const { limit, offset, orderBy, where, columns, joins, search } = options;

    // If it's a string (dynamic table), use raw SQL to ensure all columns are retrieved
    if (typeof tableOrName === 'string') {
      const tableName = tableOrName;

      // Guard against querying tables that haven't been created yet (first boot).
      if (!(await this.tables.exists(tableName))) {
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

      try {
        const result = await this.executor.query(sqlQuery, values);
        return result.rows;
      } catch (error) {
        if (this.tables.dropped(error, tableName)) return [];
        throw error;
      }
    }

    const filter = this.typedFilter(tableOrName, where, search);
    const orderExprs = this.buildOrderBy(orderBy);
    const orderList = orderExprs ? (Array.isArray(orderExprs) ? orderExprs : [orderExprs]) : undefined;
    return this.tableStatements.find(this.executor, tableOrName, { columns, joins, where: filter, orderBy: orderList, limit, offset });
  }

  /** The caller's filter, ANDed with the search over the named columns. */
  private typedFilter(table: any, where: any, search: any): any {
    return SqlTableReads.filterWithSearch(this.buildWhereConditions(where, table), where, this.typedSearch(table, search));
  }

  /** The search over named columns of a declared table, as one condition — or none. */
  private typedSearch(table: any, search: any): any {
    if (!(search && search.columns.length > 0 && search.value)) return undefined;
    const pattern = `%${search.value}%`;
    const matches = search.columns.map((column: string) => this.like(this.resolveColumn(column, table), pattern));
    return matches.length === 1 ? matches[0] : Sql.or(...matches);
  }

  async count(tableOrName: any, options: any = {}): Promise<number> {
    const { where, joins, search } = options;
    if (typeof tableOrName !== 'string') {
      // The search a `find` applies applies here too — the total describes the list being shown.
      return this.tableStatements.count(this.executor, tableOrName, { joins, where: this.typedFilter(tableOrName, where, search) });
    }

    // Guard: if given a string table name, skip the query entirely when the
    // table hasn't been created yet (first boot / fresh install).  Without
    // this guard, Postgres emits ERROR-level log entries for every
    // not-yet-synced plugin collection even though the caller catches the
    // exception.
    if (!(await this.tables.exists(tableOrName))) {
      return 0;
    }

    // For a string table there is no column map to consult, so the where keys are snake-cased into
    // identifiers (identifiers are quoted case-sensitively: `affiliateCode` would not exist).
    const normalizedWhere = await this.normalizer.normalizeWhereForTable(tableOrName, where);
    const conditions = this.buildWhereConditions(normalizedWhere);
    // The same search `find` applied, so the total describes the list the caller is showing.
    const searchCondition = this.drizzleSearchCondition(await this.resolveSearchArg(this.normalizer, tableOrName, search));
    if (searchCondition) conditions.push(searchCondition);
    const filter = PostgresTableStatements.filter(conditions, normalizedWhere);
    const query = Sql.query`select count(*) from ${Sql.identifier(tableOrName)}${filter ? Sql.query` where ${filter}` : undefined}`;
    const { text, params } = SqlRenderer.POSTGRES.render(query);
    try {
      const result = await this.executor.query({ text, rowMode: 'array' }, params);
      return Number(result.rows[0]?.[0] || 0);
    } catch (error) {
      if (this.tables.dropped(error, tableOrName)) return 0;
      throw error;
    }
  }
}
