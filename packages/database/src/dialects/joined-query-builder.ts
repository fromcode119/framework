import { JoinType } from '@database/enums/join-type.enum';
import { OrderByBuilder } from '@database/dialects/order-by-builder';
import { NamingStrategy } from '@database/naming-strategy';
import { WhereClauseParser } from '@database/dialects/where-clause-parser';
import type { WhereComparison } from '@database/dialects/where-comparison';
import type { IJoinClause } from '@database/interfaces/join-clause.interface';

/**
 * Builds a SELECT that spans joined tables, and unpacks what comes back.
 *
 * A join is the one query shape whose RESULT needs as much work as its SQL: the driver answers with
 * one flat row per match, every table's columns side by side and colliding on shared names, while the
 * caller wants each joined table nested under its own key. Both halves live here so neither can be
 * changed without the other in view.
 *
 * Composed into `BaseDialect` rather than inherited, like `SqlPredicateRenderer`. It needs exactly
 * two things from the dialect — how a name is quoted and how a predicate is rendered — so it takes
 * those two and nothing else.
 */
export class JoinedQueryBuilder {
  private readonly orderByBuilder = new OrderByBuilder();

  constructor(
    private readonly quote: (name: string) => string,
    private readonly render: (comparison: WhereComparison, quotedColumn: string, values: any[]) => string,
  ) {}

  /**
   * Build a parameterised SELECT … FROM … JOIN … WHERE … ORDER … SQL string
   * that works with the dialect's placeholder style (? or $n).
   */
  buildJoinedSQL(
    tableName: string,
    joins: IJoinClause[],
    options: { where?: any; limit?: number; offset?: number; orderBy?: any; columns?: Record<string, boolean> }
  ): { sql: string; values: any[] } {
    const { where, limit, offset, orderBy, columns } = options;

    // SELECT clause
    const selectParts: string[] = [];
    if (columns && Object.keys(columns).length > 0) {
      for (const [k, v] of Object.entries(columns)) {
        if (v) selectParts.push(`"t0".${this.quote(k)}`);
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
        selectParts.push(`"${alias}".${this.quote(col)} AS "j${i}__${col}"`);
      }
    }

    let sqlStr = `SELECT ${selectParts.join(', ')} FROM "${tableName}" "t0"`;

    // JOIN clauses
    for (let i = 0; i < joins.length; i++) {
      const join = joins[i];
      const alias = `t${i + 1}`;
      const joinType = join.type === JoinType.LEFT ? 'LEFT JOIN' : 'INNER JOIN';
      sqlStr += ` ${joinType} "${join.table}" "${alias}" ON "t0".${this.quote(join.on.from)} = "${alias}".${this.quote(join.on.to)}`;
    }

    // WHERE clause (main table columns only)
    const values: any[] = [];
    if (where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
      const comparisons = WhereClauseParser.parse(where);
      if (comparisons.length > 0) {
        const conditions = comparisons.map(
          (comparison) => this.render(comparison, `"t0".${this.quote(comparison.column)}`, values),
        );
        sqlStr += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    // ORDER BY
    if (orderBy) {
      if (typeof orderBy === 'string') {
        const parts = this.orderByBuilder.parseOrderByString(orderBy);
        if (parts.length > 0) {
          const clauses = parts
            .map((part) => `"t0".${this.quote(part.column)} ${part.direction}`);
          sqlStr += ` ORDER BY ${clauses.join(', ')}`;
        }
      } else if (typeof orderBy === 'object' && !Array.isArray(orderBy)) {
        const clauses = Object.entries(orderBy)
          .map(([k, v]) => `"t0".${this.quote(k)} ${this.orderByBuilder.normalizeOrderDirection(v)}`);
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
  processJoinedRows(rows: any[], joins: IJoinClause[]): any[] {
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
