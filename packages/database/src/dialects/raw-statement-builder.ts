import { WhereClauseParser } from '@database/dialects/where-clause-parser';
import { WhereComparison } from '@database/dialects/where-comparison';
import type { IRawStatementHooks } from '@database/interfaces/raw-statement-hooks.interface';

/**
 * The two statements built as raw SQL text rather than through drizzle: a grouped count, and a
 * filtered SELECT.
 *
 * They are here together because they are the paths that interpolate IDENTIFIERS into the statement.
 * Everything else binds its operands, but a column name cannot be bound — it is code, not data — so
 * these are the two places a caller-supplied string reaches SQL as syntax. Keeping them in one file
 * means the rule about quoting them is stated once, where both can be read against it.
 *
 * Composed into `BaseDialect` like the predicate renderer and the join builder, and for the same
 * reason: what it needs from a dialect is a handful of overridable decisions, not a base class.
 */
export class RawStatementBuilder {
  constructor(private readonly dialect: IRawStatementHooks) {}

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
  buildGroupCountSQL(
    tableName: string,
    options: { where?: any; groupBy?: string[]; dateBucket?: { column: string }; limit?: number },
  ): { sql: string; values: any[] } {
    const groupExpressions: string[] = [];
    const selectExpressions: string[] = [];

    for (const column of options.groupBy ?? []) {
      const quoted = this.dialect.quoteIdentifier(column);
      groupExpressions.push(quoted);
      selectExpressions.push(quoted);
    }
    if (options.dateBucket) {
      const expression = this.dialect.dayBucketExpression(this.dialect.quoteIdentifier(options.dateBucket.column));
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
   * Build a combined WHERE clause from exact matches (where) and LIKE search (search).
   * Exact conditions are ANDed; search columns are OR-ed and ANDed with the rest.
   * Uses getParamPlaceholder() so it works across dialects.
   */
  buildRawFilterSQL(
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
        conditions.push(this.dialect.renderPredicate(comparison, this.dialect.quoteIdentifier(comparison.column), values));
      }
    }

    if (search && search.columns.length > 0 && search.value) {
      // The searcher's own `%` and `_` are LITERAL characters, not wildcards. Unescaped, a visitor
      // typing "%" matched every row and one typing "50%" matched far more than they asked for.
      const pattern = `%${WhereComparison.escapeLikeOperand(search.value)}%`;
      const likeOp = this.dialect.getLikeOperator();
      const likeParts: string[] = [];
      for (const col of search.columns) {
        values.push(pattern);
        // Snake-cased for the same reason the `where` keys above are: the physical column is
        // snake_case, and a verbatim camelCase identifier silently degrades to a string literal.
        // Callers reaching here through `find` have already had these names validated against the
        // table's real columns (see DialectColumnNormalizer.resolveColumnsForTable).
        likeParts.push(`${this.dialect.patternColumnExpression(this.dialect.quoteIdentifier(col))} ${likeOp} ${this.dialect.getParamPlaceholder(values.length)} ESCAPE '${WhereComparison.LIKE_ESCAPE}'`);
      }
      conditions.push(`(${likeParts.join(' OR ')})`);
    }

    if (conditions.length === 0) return { sql: '', values: [] };
    return { sql: ` WHERE ${conditions.join(' AND ')}`, values };
  }

  // ─── Join support ────────────────────────────────────────────────────────────
}
