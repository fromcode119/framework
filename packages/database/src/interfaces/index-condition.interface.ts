/**
 * One condition of a PARTIAL index: the index covers only the rows that satisfy every condition.
 *
 * `value: null` is absence (`IS NULL`, or `IS NOT NULL` with `negate`); a scalar is equality (`<>`
 * with `negate`). Structured on purpose — the predicate of `CREATE INDEX` cannot take bind parameters,
 * so it is rendered from validated identifiers and escaped literals, never from SQL a caller wrote.
 */
export interface IIndexCondition {
  column: string;
  value: string | number | boolean | null;
  negate?: boolean;
}
