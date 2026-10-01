import type { ISqlTag } from '@database/interfaces/sql-tag.interface';
import type { ISqlValueEncoder } from '@database/interfaces/sql-value-encoder.interface';
import { SqlFragment } from '@database/sql/sql-fragment';
import { SqlName } from '@database/sql/sql-name';
import { SqlParam } from '@database/sql/sql-param';
import { SqlText } from '@database/sql/sql-text';
import { SqlColumn } from '@database/sql/sql-column';
import { SqlTable } from '@database/sql/sql-table';

/**
 * Building SQL. `Sql.query` is the template tag: its text is SQL, and each interpolated value is kept
 * as it is — a fragment, identifier, table or column renders as SQL, anything else as a bound value —
 * until a dialect's `SqlRenderer` renders it. The operators build the same fragments a `where` needs.
 */
export class Sql {
  static readonly query = (strings: TemplateStringsArray, ...values: unknown[]): SqlFragment => {
    const chunks: unknown[] = [];
    if (values.length > 0 || (strings.length > 0 && strings[0] !== '')) chunks.push(new SqlText(strings[0]));
    values.forEach((value, index) => chunks.push(value, new SqlText(strings[index + 1])));
    return new SqlFragment(chunks);
  };

  /** Literal text, never bound — only ever for text the code itself wrote. */
  static raw(text: string): SqlFragment {
    return new SqlFragment([new SqlText(text)]);
  }

  static identifier(name: string): SqlName {
    return new SqlName(name);
  }

  static join(chunks: unknown[], separator?: unknown): SqlFragment {
    return new SqlFragment(chunks.flatMap((chunk, index) => (index > 0 && separator !== undefined ? [separator, chunk] : [chunk])));
  }

  static param(value: unknown, encoder?: ISqlValueEncoder): SqlParam {
    return new SqlParam(value, encoder);
  }

  static empty(): SqlFragment {
    return new SqlFragment([]);
  }

  /** The tag with its helpers attached, for callers handed a drizzle-shaped `sql` (the plugin `db.sql`). */
  static tag(): ISqlTag {
    return Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => Sql.query(strings, ...values), {
      raw: Sql.raw, identifier: Sql.identifier, join: Sql.join, param: Sql.param, empty: Sql.empty,
      fromList: (chunks: unknown[]) => new SqlFragment(chunks),
    });
  }

  static eq(left: unknown, right: unknown): SqlFragment { return Sql.query`${left} = ${Sql.bind(right, left)}`; }
  static ne(left: unknown, right: unknown): SqlFragment { return Sql.query`${left} <> ${Sql.bind(right, left)}`; }
  static gt(left: unknown, right: unknown): SqlFragment { return Sql.query`${left} > ${Sql.bind(right, left)}`; }
  static gte(left: unknown, right: unknown): SqlFragment { return Sql.query`${left} >= ${Sql.bind(right, left)}`; }
  static lt(left: unknown, right: unknown): SqlFragment { return Sql.query`${left} < ${Sql.bind(right, left)}`; }
  static lte(left: unknown, right: unknown): SqlFragment { return Sql.query`${left} <= ${Sql.bind(right, left)}`; }

  /** Undefined conditions are dropped; none is no condition at all, one is itself, more are parenthesised. */
  static and(...conditions: unknown[]): SqlFragment | undefined { return Sql.combine(conditions, ' and '); }
  static or(...conditions: unknown[]): SqlFragment | undefined { return Sql.combine(conditions, ' or '); }
  static not(condition: unknown): SqlFragment { return Sql.query`not ${condition}`; }

  static isNull(value: unknown): SqlFragment { return Sql.query`${value} is null`; }
  static isNotNull(value: unknown): SqlFragment { return Sql.query`${value} is not null`; }

  /** An empty list is the constant it means — matches nothing — rather than invalid SQL. */
  static inArray(column: unknown, values: unknown): SqlFragment {
    if (!Array.isArray(values)) return Sql.query`${column} in ${Sql.bind(values, column)}`;
    return values.length === 0 ? Sql.query`false` : Sql.query`${column} in ${values.map((value) => Sql.bind(value, column))}`;
  }

  static notInArray(column: unknown, values: unknown): SqlFragment {
    if (!Array.isArray(values)) return Sql.query`${column} not in ${Sql.bind(values, column)}`;
    return values.length === 0 ? Sql.query`true` : Sql.query`${column} not in ${values.map((value) => Sql.bind(value, column))}`;
  }

  static between(column: unknown, min: unknown, max: unknown): SqlFragment { return Sql.query`${column} between ${Sql.bind(min, column)} and ${Sql.bind(max, column)}`; }
  static notBetween(column: unknown, min: unknown, max: unknown): SqlFragment { return Sql.query`${column} not between ${Sql.bind(min, column)} and ${Sql.bind(max, column)}`; }
  static exists(subquery: unknown): SqlFragment { return Sql.query`exists ${subquery}`; }
  static notExists(subquery: unknown): SqlFragment { return Sql.query`not exists ${subquery}`; }

  static like(column: unknown, pattern: unknown): SqlFragment { return Sql.query`${column} like ${pattern}`; }
  static notLike(column: unknown, pattern: unknown): SqlFragment { return Sql.query`${column} not like ${pattern}`; }
  static ilike(column: unknown, pattern: unknown): SqlFragment { return Sql.query`${column} ilike ${pattern}`; }
  static notIlike(column: unknown, pattern: unknown): SqlFragment { return Sql.query`${column} not ilike ${pattern}`; }

  static asc(column: unknown): SqlFragment { return Sql.query`${column} asc`; }
  static desc(column: unknown): SqlFragment { return Sql.query`${column} desc`; }

  static count(expression?: unknown): SqlFragment { return Sql.query`count(${expression || Sql.raw('*')})`; }
  static avg(expression: unknown): SqlFragment { return Sql.query`avg(${expression})`; }
  static sum(expression: unknown): SqlFragment { return Sql.query`sum(${expression})`; }
  static min(expression: unknown): SqlFragment { return Sql.query`min(${expression})`; }
  static max(expression: unknown): SqlFragment { return Sql.query`max(${expression})`; }

  /** A value compared with a COLUMN is bound through that column's encoder; SQL stays SQL. */
  private static bind(value: unknown, column: unknown): unknown {
    if (!(column instanceof SqlColumn)) return value;
    if (value instanceof SqlFragment || value instanceof SqlParam || value instanceof SqlColumn || value instanceof SqlName || value instanceof SqlTable) return value;
    return new SqlParam(value, column);
  }

  private static combine(conditions: unknown[], separator: string): SqlFragment | undefined {
    const present = conditions.filter((condition) => condition !== undefined);
    if (present.length === 0) return undefined;
    if (present.length === 1) return new SqlFragment(present);
    return new SqlFragment([new SqlText('('), Sql.join(present, new SqlText(separator)), new SqlText(')')]);
  }
}
