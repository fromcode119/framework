import { JoinType } from '@database/enums/join-type.enum';
import { sql, eq, ne, gt, gte, lt, lte, isNull, isNotNull } from 'drizzle-orm';
import { WhereClauseParser } from '@database/dialects/where-clause-parser';
import { NamingStrategy } from '@database/naming-strategy';
import type { DialectColumnNormalizer } from '@database/dialects/dialect-column-normalizer';
import type { IJoinClause } from '@database/interfaces/join-clause.interface';
import { OrderByBuilder } from '@database/dialects/order-by-builder';

/**
 * BaseDialect - Shared utilities for database dialect implementations
 *
 * Provides common helper methods used across Postgres, MySQL, and SQLite dialects.
 * This reduces code duplication while allowing each dialect to maintain its specific implementation.
 */
export abstract class BaseDialect {
  protected orderByBuilder = new OrderByBuilder();

  /**
   * Marks this connection as the PLATFORM's own — the one that runs migrations and schema sync.
   *
   * Such a connection is never serving a tenant request, and it legitimately writes deployment-level
   * rows (schema fingerprints and the like) that belong to no tenant. Default is a no-op: a driver
   * without row-level security has nothing to mark.
   */
  markAsPlatformConnection(): void {
    // no-op
  }

  /**
   * Whether this driver can actually isolate tenants. Default FALSE.
   *
   * The default is deliberately the refusing one. An earlier version of this class returned a
   * permissive passthrough, which meant any driver that did not override it — MySQL, and every
   * future driver — silently ran with NO isolation and no error: every tenant reading every other
   * tenant's rows, looking perfectly healthy. A base class must not hand out a security property
   * nobody implemented.
   */
  supportsTenantIsolation(): boolean {
    return false;
  }

  /**
   * Runs `fn` with every statement bound to `tenantId`.
   *
   * Overridden per driver by its isolation strategy — Postgres holds a pooled client with
   * `app.tenant_id` set (see TenantConnectionScope); a separate-database driver would bind that
   * tenant's connection. A driver that has not implemented one REFUSES rather than running `fn`
   * unisolated.
   *
   * This is never reached on a single-tenant deployment: TenantMode leaves tenancy off entirely, so
   * no tenant scope is opened and drivers without a strategy keep working exactly as before.
   */
  async withTenant<T>(_tenantId: string, _fn: () => Promise<T>): Promise<T> {
    throw new Error(
      `${this.constructor.name}: this driver has no tenant isolation strategy, so a tenant-scoped `
      + 'request cannot be served safely. Refusing rather than running the query unisolated.',
    );
  }

  /** No row-level security here, so there is nothing to lift: `fn` runs as is. */
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  /**
   * Normalize parameter values for database queries
   * Handles undefined, null, Date, Buffer, and objects (JSON stringify)
   */
  protected normalizeParamValue(value: any): any {
    return NamingStrategy.normalizeParamValue(value);
  }

  /**
   * Build WHERE clause conditions from a plain object
   * Converts { id: 1, status: 'active' } into drizzle condition array
   *
   * Keys are canonical camelCase field names; `resolveColumn` maps each to the real column (see there).
   * Pass `tableOrName` whenever the caller has a drizzle table object so its declared columns win.
   */
  protected buildWhereConditions(where: any, tableOrName?: any): any[] {
    if (typeof where !== 'object' || where === null) return [];
    if (Object.getPrototypeOf(where) !== Object.prototype) return [];

    // Same parse as the raw-SQL path, so `{ createdAt: { gte, lte } }` means the same range whether the
    // caller reached a drizzle table object or a string table name.
    return WhereClauseParser.parse(where).map((comparison) => {
      const column = this.resolveColumn(comparison.column, tableOrName);
      // Same null rule as the raw-SQL paths: absence is IS NULL / IS NOT NULL, never `= NULL`.
      if (comparison.value === null) {
        if (comparison.operator === 'eq') return isNull(column);
        if (comparison.operator === 'ne') return isNotNull(column);
        throw new Error(`Invalid where clause: operator "${comparison.operator}" cannot take null (column "${comparison.column}"). Only eq/ne accept null, as IS NULL / IS NOT NULL.`);
      }
      return BaseDialect.DRIZZLE_OPERATORS[comparison.operator](column, comparison.value);
    });
  }

  /**
   * The left-hand column expression for one predicate, given the caller's already-quoted column.
   *
   * Equality operators route through `equalityColumnExpression` so a dialect can align the STORED
   * precision with what the driver's read-back value can express — see the Postgres override, where a
   * microsecond timestamp read back as a millisecond JS Date could otherwise never equal itself
   * again (which broke every optimistic lock of the form `update(table, { id, updatedAt }, …)`).
   * Range operators keep the plain column: they are not an identity check, so operand precision does
   * not flip their meaning.
   */
  protected comparisonColumn(comparison: { operator: string; value: any }, quotedColumn: string): string {
    if (comparison.operator === 'eq' || comparison.operator === 'ne') {
      return this.equalityColumnExpression(quotedColumn, comparison.value);
    }
    return quotedColumn;
  }

  /** Dialect hook: the column expression used when comparing for (in)equality against `value`. */
  protected equalityColumnExpression(quotedColumn: string, _value: any): string {
    return quotedColumn;
  }

  /**
   * The predicate for a null operand. Only equality has a meaning against absence; a range against
   * null is a call-site bug and raises rather than matching nothing.
   */
  private static nullPredicate(comparison: { operator: string; column: string }): string {
    if (comparison.operator === 'eq') return 'IS NULL';
    if (comparison.operator === 'ne') return 'IS NOT NULL';
    throw new Error(`Invalid where clause: operator "${comparison.operator}" cannot take null (column "${comparison.column}"). Only eq/ne accept null, as IS NULL / IS NOT NULL.`);
  }

  /** Canonical operator name -> drizzle condition builder, keyed exactly like WhereComparison. */
  private static readonly DRIZZLE_OPERATORS: Record<string, (column: any, value: any) => any> = {
    eq, ne, gt, gte, lt, lte,
  };

  /**
   * Build ORDER BY clause from various formats
   * Supports: string ("created_at desc"), object ({ created_at: 'desc' }), or drizzle expressions
   */
  protected buildOrderBy(orderBy: any): any {
    return this.orderByBuilder.buildOrderBy(orderBy);
  }

  /**
   * Build raw SQL ORDER BY clause for string-based queries
   */
  protected buildRawOrderByClause(orderBy: any): string {
    return this.orderByBuilder.buildRawOrderByClause(orderBy);
  }

  /**
   * Build raw SQL WHERE clause for string-based queries
   * Returns SQL string and parameter values array
   */
  protected buildRawWhereClause(where: any): { sql: string; values: any[] } {
    if (!where || typeof where !== 'object' || Object.getPrototypeOf(where) !== Object.prototype) {
      return { sql: '', values: [] };
    }

    const comparisons = WhereClauseParser.parse(where);
    if (comparisons.length === 0) {
      return { sql: '', values: [] };
    }

    // Null operands become IS NULL / IS NOT NULL and consume no placeholder — the same rule as
    // `buildRawFilterSQL`, because the two paths emitting different predicates from one parse is
    // exactly the drift the shared parser exists to prevent.
    const conditions: string[] = [];
    const values: any[] = [];
    for (const comparison of comparisons) {
      if (comparison.value === null) {
        conditions.push(`${this.quoteIdentifier(comparison.column)} ${BaseDialect.nullPredicate(comparison)}`);
        continue;
      }
      values.push(this.normalizeParamValue(comparison.value));
      conditions.push(`${this.comparisonColumn(comparison, this.quoteIdentifier(comparison.column))} ${comparison.sqlOperator} ${this.getParamPlaceholder(values.length)}`);
    }

    return {
      sql: ` WHERE ${conditions.join(' AND ')}`,
      values
    };
  }

  /**
   * Returns the SQL LIKE operator string for this dialect.
   * Postgres overrides this to return 'ILIKE' for case-insensitive matching.
   */
  protected getLikeOperator(): string {
    return 'LIKE';
  }

  /**
   * The expression that turns a timestamp column into its `YYYY-MM-DD` day, in this dialect's SQL.
   * SQLite stores these columns as TEXT so it slices; the others format a real timestamp.
   */
  protected dayBucketExpression(quotedColumn: string): string {
    return `substr(${quotedColumn}, 1, 10)`;
  }

  /**
   * COUNT(*) grouped by columns — real SQL aggregation for a string-named table.
   *
   * This is the primitive that lets an analytics screen ask "how many per outcome / per file / per
   * day" as ONE query instead of paging every row into application memory and counting there. Group
   * columns pass through the same identifier sanitiser as everything else; the optional `dateBucket`
   * groups a timestamp column by calendar day using the dialect's own expression.
   *
   * Returns one row per group: the grouped columns (day under `day`), plus `count`. Ordered by count
   * descending, because every caller so far wants the biggest groups first; an `orderBy` option can
   * arrive when a caller genuinely needs another order.
   */
  protected buildGroupCountSQL(
    tableName: string,
    options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number },
  ): { sql: string; values: any[] } {
    const groupExpressions: string[] = [];
    const selectExpressions: string[] = [];

    for (const column of options.groupBy ?? []) {
      const quoted = this.quoteIdentifier(column);
      groupExpressions.push(quoted);
      selectExpressions.push(quoted);
    }
    if (options.dateBucket) {
      const expression = this.dayBucketExpression(this.quoteIdentifier(options.dateBucket.column));
      groupExpressions.push(expression);
      selectExpressions.push(`${expression} AS "day"`);
    }
    if (groupExpressions.length === 0) {
      throw new Error('groupCount needs at least one groupBy column or a dateBucket.');
    }

    const { sql: whereSql, values } = this.buildRawFilterSQL(options.where);
    let sqlStr = `SELECT ${selectExpressions.join(', ')}, COUNT(*) AS "count" FROM "${tableName}"${whereSql}`
      + ` GROUP BY ${groupExpressions.join(', ')} ORDER BY COUNT(*) DESC`;
    if (options.limit) sqlStr += ` LIMIT ${Math.max(1, Math.floor(options.limit))}`;

    return { sql: sqlStr, values };
  }

  /**
   * Quote one identifier for raw-SQL interpolation, rejecting anything that is not a plain identifier.
   *
   * Every raw builder below interpolates column names directly into the statement, so the name is the
   * one place a caller-supplied string reaches SQL as CODE rather than as a bound parameter. Neither
   * plain quoting nor drizzle's `sql.identifier` escapes an embedded double quote, so a name carrying
   * one would close the quoted identifier and inject. Names are canonical schema field names — always
   * plain identifiers — so anything else is rejected rather than escaped.
   */
  protected quoteIdentifier(name: string): string {
    return `"${NamingStrategy.toSafeColumnIdentifier(name)}"`;
  }

  /**
   * Resolve one canonical field name (a `where` key or a `search.columns` entry) to a column expression.
   *
   * Callers pass CANONICAL camelCase schema field names; the PHYSICAL column is snake_case. A drizzle
   * table object keys its columns by that same camelCase name, so prefer the declared property — it
   * already maps to the right physical column, and it is the only thing that gets a genuinely
   * camelCase physical column right. When the table object does not declare it — or there is no table
   * object at all — fall back to a raw identifier, snake_cased: a verbatim camelCase identifier matches
   * no column, and SQLite does not always reject it but degrades the double-quoted name to a STRING
   * LITERAL, so the predicate compares the column NAME as text (matching nothing, or every row when the
   * term is a substring of that name). Postgres/MySQL raise "column does not exist" instead.
   *
   * The fallback is shape-checked: `sql.identifier` does NOT escape an embedded double quote, so an
   * unchecked name would break out of the quoted identifier.
   */
  protected resolveColumn(column: string, tableOrName?: any): any {
    const declared = tableOrName?.[column] ?? tableOrName?.[NamingStrategy.toSnakeCase(column)];
    if (declared !== undefined && declared !== null) return declared;
    return sql`${sql.identifier(NamingStrategy.toSafeColumnIdentifier(column))}`;
  }

  /**
   * Resolve a `search` option's canonical field names to REAL columns of `tableName`, or throw.
   *
   * Every string-table read path funnels through here so an unresolvable search column can never reach
   * SQL — on SQLite it would degrade to a string literal and silently return the wrong rows. Returns
   * undefined when there is nothing to search on, so the filter builder omits the clause entirely.
   */
  protected async resolveSearchArg(
    normalizer: DialectColumnNormalizer,
    tableName: string,
    search?: { columns: string[]; value: string }
  ): Promise<{ columns: string[]; value: string } | undefined> {
    if (search === undefined || search === null) return undefined;

    // A malformed option must not be DISCARDED: dropping it silently turns a filtered request into an
    // unfiltered one, which answers a search with the entire table — the same silent-wrong-result class
    // as an unresolvable column. `search: 'term'` (a bare string instead of { columns, value }) is the
    // shape that actually shipped, so it is named explicitly here.
    if (!Array.isArray((search as any).columns) || (search as any).columns.length === 0) {
      throw new Error(
        `Invalid search option for table "${tableName}": expected { columns: string[], value: string }, ` +
        `received ${JSON.stringify(search)}. A search with no columns would return the whole table.`
      );
    }

    // An empty term is how callers express "no search"; it filters nothing by design.
    if (!search.value) return undefined;

    const columns = await normalizer.resolveColumnsForTable(tableName, search.columns);
    return { columns, value: search.value };
  }

  /**
   * Build a combined WHERE clause from exact matches (where) and LIKE search (search).
   * Exact conditions are ANDed; search columns are OR-ed and ANDed with the rest.
   * Uses getParamPlaceholder() so it works across dialects.
   */
  protected buildRawFilterSQL(
    where: any,
    search?: { columns: string[]; value: string }
  ): { sql: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];

    // A `where` that is an object but NOT a plain object cannot be parsed on this raw-SQL path — the
    // only supported shape is `{ column: value }` / `{ column: { gte, lte } }`. Silently skipping it
    // drops the filter ENTIRELY and turns the query into "every row", which is the most dangerous
    // failure this layer has: it is invisible at the call site and reads as a successful query.
    // It shipped exactly that way — WorkflowService passed a drizzle `and(ne(...), lte(...))`
    // expression with a STRING table name, so every scheduler tick re-published every row of every
    // workflow-enabled collection. Fail loudly instead; drizzle expressions belong on the typed-table
    // path, which handles them.
    if (where && typeof where === 'object' && Object.getPrototypeOf(where) !== Object.prototype) {
      throw new Error(
        'Unsupported `where` for a raw-SQL (string table) query: expected a plain object such as ' +
        '{ status: { ne: "published" } }. A drizzle expression (and/eq/ne/lte/…) is only supported ' +
        'when the table is passed as a typed table object, not as a table NAME.'
      );
    }

    if (where && typeof where === 'object') {
      for (const comparison of WhereClauseParser.parse(where)) {
        // `= NULL` is never true in SQL, so a null operand used to make the predicate match NOTHING —
        // silently. `{ revokedAt: null }` guards and `{ mediaId: { ne: null } }` filters both fell into
        // it. Null is a real operand meaning absence; it becomes IS NULL / IS NOT NULL, param-free.
        if (comparison.value === null) {
          conditions.push(`${this.quoteIdentifier(comparison.column)} ${BaseDialect.nullPredicate(comparison)}`);
          continue;
        }
        values.push(this.normalizeParamValue(comparison.value));
        conditions.push(
          `${this.comparisonColumn(comparison, this.quoteIdentifier(comparison.column))} ${comparison.sqlOperator} ${this.getParamPlaceholder(values.length)}`
        );
      }
    }

    if (search && search.columns.length > 0 && search.value) {
      const pattern = `%${search.value}%`;
      const likeOp = this.getLikeOperator();
      const likeParts: string[] = [];
      for (const col of search.columns) {
        values.push(pattern);
        // Snake-cased for the same reason the `where` keys above are: the physical column is
        // snake_case, and a verbatim camelCase identifier silently degrades to a string literal.
        // Callers reaching here through `find` have already had these names validated against the
        // table's real columns (see DialectColumnNormalizer.resolveColumnsForTable).
        likeParts.push(`${this.quoteIdentifier(col)} ${likeOp} ${this.getParamPlaceholder(values.length)}`);
      }
      conditions.push(`(${likeParts.join(' OR ')})`);
    }

    if (conditions.length === 0) return { sql: '', values: [] };
    return { sql: ` WHERE ${conditions.join(' AND ')}`, values };
  }

  // ─── Join support ────────────────────────────────────────────────────────────

  /**
   * Returns the SQL parameter placeholder for the given 1-based index.
   * Override in dialects that use positional placeholders ($1, $2 …).
   */
  protected getParamPlaceholder(_index: number): string {
    return '?';
  }

  /**
   * Execute a raw SELECT string against the underlying connection.
   * Must be overridden by each concrete dialect.
   */
  protected async executeRawSelect(_sql: string, _values: any[]): Promise<any[]> {
    throw new Error('executeRawSelect is not implemented for this dialect');
  }

  /**
   * Build a parameterised SELECT … FROM … JOIN … WHERE … ORDER … SQL string
   * that works with the dialect's placeholder style (? or $n).
   */
  protected buildJoinedSQL(
    tableName: string,
    joins: IJoinClause[],
    options: { where?: any; limit?: number; offset?: number; orderBy?: any; columns?: Record<string, boolean> }
  ): { sql: string; values: any[] } {
    const { where, limit, offset, orderBy, columns } = options;

    // SELECT clause
    const selectParts: string[] = [];
    if (columns && Object.keys(columns).length > 0) {
      for (const [k, v] of Object.entries(columns)) {
        if (v) selectParts.push(`"t0".${this.quoteIdentifier(k)}`);
      }
    } else {
      selectParts.push('"t0".*');
    }
    for (let i = 0; i < joins.length; i++) {
      const alias = `t${i + 1}`;
      for (const col of joins[i].columns) {
        // The AS alias keeps the caller's spelling — `processJoinedRows` turns it back into the result
        // key, so snake-casing it here would silently rename every joined field. Safe to interpolate:
        // `quoteIdentifier` above has already rejected anything that is not a plain identifier.
        selectParts.push(`"${alias}".${this.quoteIdentifier(col)} AS "j${i}__${col}"`);
      }
    }

    let sqlStr = `SELECT ${selectParts.join(', ')} FROM "${tableName}" "t0"`;

    // JOIN clauses
    for (let i = 0; i < joins.length; i++) {
      const join = joins[i];
      const alias = `t${i + 1}`;
      const joinType = join.type === JoinType.LEFT ? 'LEFT JOIN' : 'INNER JOIN';
      sqlStr += ` ${joinType} "${join.table}" "${alias}" ON "t0".${this.quoteIdentifier(join.on.from)} = "${alias}".${this.quoteIdentifier(join.on.to)}`;
    }

    // WHERE clause (main table columns only)
    const values: any[] = [];
    if (where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
      const comparisons = WhereClauseParser.parse(where);
      if (comparisons.length > 0) {
        const conditions = comparisons.map((comparison) => {
          values.push(this.normalizeParamValue(comparison.value));
          return `${this.comparisonColumn(comparison, `"t0".${this.quoteIdentifier(comparison.column)}`)} ${comparison.sqlOperator} ${this.getParamPlaceholder(values.length)}`;
        });
        sqlStr += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    // ORDER BY
    if (orderBy) {
      if (typeof orderBy === 'string') {
        const parts = this.orderByBuilder.parseOrderByString(orderBy);
        if (parts.length > 0) {
          const clauses = parts
            .map((part) => `"t0".${this.quoteIdentifier(part.column)} ${part.direction}`);
          sqlStr += ` ORDER BY ${clauses.join(', ')}`;
        }
      } else if (typeof orderBy === 'object' && !Array.isArray(orderBy)) {
        const clauses = Object.entries(orderBy)
          .map(([k, v]) => `"t0".${this.quoteIdentifier(k)} ${this.orderByBuilder.normalizeOrderDirection(v)}`);
        sqlStr += ` ORDER BY ${clauses.join(', ')}`;
      }
    }

    if (limit) sqlStr += ` LIMIT ${limit}`;
    if (offset) sqlStr += ` OFFSET ${offset}`;

    return { sql: sqlStr, values };
  }

  /**
   * Post-process raw rows from a joined query.
   * Columns prefixed with "j{n}__" are extracted and either merged flat or
   * nested under join.as (if specified).
   */
  protected processJoinedRows(rows: any[], joins: IJoinClause[]): any[] {
    return rows.map(row => {
      const result: any = {};
      const joinData: Record<number, any> = {};
      for (let i = 0; i < joins.length; i++) joinData[i] = {};

      for (const [key, value] of Object.entries(row)) {
        const m = key.match(/^j(\d+)__(.+)$/);
        if (m) {
          joinData[Number(m[1])][m[2]] = value;
        } else {
          result[key] = value;
        }
      }

      for (let i = 0; i < joins.length; i++) {
        if (joins[i].as) {
          result[joins[i].as!] = joinData[i];
        } else {
          Object.assign(result, joinData[i]);
        }
      }

      return result;
    });
  }
}
