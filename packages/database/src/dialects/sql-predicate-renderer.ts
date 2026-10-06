import { Sql } from '@database/sql/sql';
import { WhereClauseParser } from '@database/dialects/where-clause-parser';
import { WhereComparison } from '@database/dialects/where-comparison';
import type { ISqlDialectHooks } from '@database/interfaces/sql-dialect-hooks.interface';

/**
 * Turns one WHERE description into SQL — as raw text with bound values, or as `Sql` condition fragments.
 *
 * COMPOSED, NOT INHERITED, which is the reason this class exists at all. It was ~115 lines inside
 * `BaseDialect`, and the obvious way to split that file — make predicates a base class — does not
 * compile: rendering a predicate needs `getParamPlaceholder` and `resolveColumn`, while assembling a
 * clause needs `renderPredicate`. The dependency runs BOTH ways, and inheritance cannot cut a cycle.
 * So the dialect hands this object the few decisions only a dialect can make and keeps the rest.
 *
 * The hooks are CLOSURES over the dialect rather than the dialect itself, so a subclass override
 * still wins — `PostgresDatabaseManager.getParamPlaceholder` is what runs, because the closure
 * resolves `this` when it is called.
 *
 * The traps this keeps in one place:
 *   - `= NULL` is true of NOTHING in SQL, so a null operand becomes IS NULL / IS NOT NULL. A
 *     predicate left comparing to null matches no rows, silently, and reads as "no data";
 *   - a set operand is `IN (...)`, not a chain of equalities;
 *   - a pattern match wraps the column differently per driver, and escapes its own wildcards.
 */
export class SqlPredicateRenderer {
  constructor(private readonly dialect: ISqlDialectHooks) {}

  /**
   * Build WHERE clause conditions from a plain object
   * Converts { id: 1, status: 'active' } into an array of condition fragments
   *
   * Keys are canonical camelCase field names; `resolveColumn` maps each to the real column (see there).
   * Pass `tableOrName` whenever the caller has a declared table so its declared columns win.
   */
  buildWhereConditions(where: any, tableOrName?: any): any[] {
    if (typeof where !== 'object' || where === null) return [];
    if (Object.getPrototypeOf(where) !== Object.prototype) return [];

    // Same parse as the raw-SQL path, so `{ createdAt: { gte, lte } }` means the same range whether the
    // caller reached a declared table or a string table name.
    return WhereClauseParser.parse(where).map((comparison) => {
      const column = this.dialect.resolveColumn(comparison.column, tableOrName);
      // Same null rule as the raw-SQL paths: absence is IS NULL / IS NOT NULL, never `= NULL`.
      if (comparison.value === null) {
        if (comparison.operator === 'eq') return Sql.isNull(column);
        if (comparison.operator === 'ne') return Sql.isNotNull(column);
        throw new Error(`Invalid where clause: operator "${comparison.operator}" cannot take null (column "${comparison.column}"). Only eq/ne accept null, as IS NULL / IS NOT NULL.`);
      }
      if (comparison.isSet) {
        // A SQL `IN ()` with no values is a syntax error. An empty set is a real
        // thing to ask for, though — "any of the ids this page selected", where the page selected
        // none — so it renders as the constant it means, rather than throwing at the call site.
        if (comparison.values.length === 0) return comparison.operator === 'in' ? Sql.query`1 = 0` : Sql.query`1 = 1`;
        return comparison.operator === 'in' ? Sql.inArray(column, comparison.values) : Sql.notInArray(column, comparison.values);
      }
      if (comparison.isPattern) return this.fragmentPatternCondition(column, comparison);
      return SqlPredicateRenderer.FRAGMENT_OPERATORS[comparison.operator](column, comparison.value);
    });
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

  /**
   * The ONE place a `where` predicate becomes SQL on the raw-string paths.
   *
   * Every raw builder below used to inline the same `column operator placeholder` line, which
   * quietly assumed every operator takes exactly one operand and one placeholder. That assumption is
   * why `in` could not exist: callers wanting "any of these statuses" had to fetch rows and filter
   * them in memory, which is slower and — past the fetch limit — silently WRONG. It also let the
   * three copies drift: the join builder had never grown the null handling the other two have, so a
   * `{ deletedAt: null }` filter on a joined query emitted `= NULL` and matched nothing. Routing all
   * three through here is what fixed that, and what stops the next divergence.
   *
   * `values` is appended to in step with the placeholders, so operands stay parameterised: nothing a
   * caller supplies is ever interpolated into the SQL string.
   */
  renderPredicate(comparison: WhereComparison, quotedColumn: string, values: any[]): string {
    if (comparison.isSet) return this.renderSetPredicate(comparison, quotedColumn, values);
    if (comparison.isPattern) return this.renderPatternPredicate(comparison, quotedColumn, values);
    // `= NULL` is never true in SQL, so a null operand would make the predicate match NOTHING —
    // silently. Null is a real operand meaning absence; it becomes IS NULL / IS NOT NULL, param-free.
    if (comparison.value === null) return `${quotedColumn} ${SqlPredicateRenderer.nullPredicate(comparison)}`;
    values.push(this.dialect.normalizeParamValue(comparison.value));
    return `${this.dialect.comparisonColumn(comparison, quotedColumn)} ${comparison.sqlOperator} ${this.dialect.getParamPlaceholder(values.length)}`;
  }
  /** `col IN ($1, $2, …)` — one placeholder per element, never an interpolated list. */
  private renderSetPredicate(comparison: WhereComparison, quotedColumn: string, values: any[]): string {
    const operands = comparison.values;
    // `IN ()` is a syntax error, so the empty set renders as the constant it MEANS: `in: []` matches
    // no row, `notIn: []` excludes none. Emitting nothing instead would drop the filter and return
    // every row — the failure mode this layer has been bitten by before.
    if (operands.length === 0) return comparison.operator === 'in' ? '1 = 0' : '1 = 1';
    // A NULL inside a set never matches under IN (and silently voids NOT IN entirely), so it is a
    // call-site bug rather than a filter — the same rule as a range against null.
    if (operands.some((operand) => operand === null || operand === undefined)) {
      throw new Error(`Invalid where clause for column "${comparison.column}": "${comparison.operator}" cannot contain null. Ask for absence with { ${comparison.column}: null } instead.`);
    }
    const placeholders = operands.map((operand) => {
      values.push(this.dialect.normalizeParamValue(operand));
      return this.dialect.getParamPlaceholder(values.length);
    });
    return `${quotedColumn} ${WhereComparison.SET_OPERATORS[comparison.operator]} (${placeholders.join(', ')})`;
  }
  /** `col LIKE $1 ESCAPE '!'` — the operand carries the wildcards, the caller's text never does. */
  private renderPatternPredicate(comparison: WhereComparison, quotedColumn: string, values: any[]): string {
    if (comparison.value === null || comparison.value === undefined) {
      throw new Error(`Invalid where clause: operator "${comparison.operator}" cannot take null (column "${comparison.column}").`);
    }
    values.push(comparison.likePattern);
    return `${this.dialect.patternColumnExpression(quotedColumn)} ${this.dialect.getLikeOperator()} ${this.dialect.getParamPlaceholder(values.length)} ESCAPE '${WhereComparison.LIKE_ESCAPE}'`;
  }
  /**
   * The fragment equivalent of `renderPatternPredicate`.
   *
   * A plain `like`/`ilike` emits no ESCAPE clause, so a pattern built through it would let
   * a user's own `%` act as a wildcard. This keeps the escape character the raw paths use, and asks
   * the dialect for the same operator (Postgres answers ILIKE), so a search means one thing whether
   * the caller reached a typed table or a table name.
   */
  fragmentPatternCondition(column: any, comparison: WhereComparison): any {
    return Sql.query`${this.dialect.fragmentPatternColumn(column)} ${Sql.raw(this.dialect.getLikeOperator())} ${comparison.likePattern} ESCAPE ${Sql.raw(`'${WhereComparison.LIKE_ESCAPE}'`)}`;
  }
  /** Canonical operator name -> condition builder, keyed exactly like WhereComparison. */
  private static readonly FRAGMENT_OPERATORS: Record<string, (column: any, value: any) => any> = {
    eq: Sql.eq, ne: Sql.ne, gt: Sql.gt, gte: Sql.gte, lt: Sql.lt, lte: Sql.lte,
  };
  /**
   * Build raw SQL WHERE clause for string-based queries
   * Returns SQL string and parameter values array
   */
  buildRawWhereClause(where: any): { sql: string; values: any[] } {
    if (!where || typeof where !== 'object' || Object.getPrototypeOf(where) !== Object.prototype) {
      return { sql: '', values: [] };
    }

    const comparisons = WhereClauseParser.parse(where);
    if (comparisons.length === 0) {
      return { sql: '', values: [] };
    }

    // Rendered by the shared `renderPredicate`, because three paths emitting different predicates from
    // one parse is exactly the drift the shared parser exists to prevent.
    const values: any[] = [];
    const conditions = comparisons.map(
      (comparison) => this.renderPredicate(comparison, this.dialect.quoteIdentifier(comparison.column), values),
    );

    return {
      sql: ` WHERE ${conditions.join(' AND ')}`,
      values
    };
  }

  /**
   * The fragment twin of the OR-ed LIKE group `buildRawFilterSQL` appends, so `count` can apply the
   * SAME search `find` did.
   *
   * It could not, until now: `count` accepted only `where`, so a searched list showed the total of
   * the UNSEARCHED table — "1 of 240 results" under a list of one. A total that does not describe the
   * list beside it is a lie the operator has no way to spot.
   */
  fragmentSearchCondition(search?: { columns: string[]; value: string }): any {
    if (!search || search.columns.length === 0 || !search.value) return null;
    const pattern = `%${WhereComparison.escapeLikeOperand(search.value)}%`;
    const escapeClause = Sql.raw(`ESCAPE '${WhereComparison.LIKE_ESCAPE}'`);
    const likeOperator = Sql.raw(this.dialect.getLikeOperator());
    const parts = search.columns.map(
      (column) => Sql.query`${Sql.raw(this.dialect.patternColumnExpression(this.dialect.quoteIdentifier(column)))} ${likeOperator} ${pattern} ${escapeClause}`,
    );
    return parts.length === 1 ? parts[0] : Sql.or(...parts);
  }

}
