/**
 * The decisions only a DIALECT can make, as the predicate renderer needs them.
 *
 * Deliberately the smallest surface that works: how a name is quoted, how a bound parameter is
 * spelled, how a value is normalised, and how a column is wrapped for comparison or pattern
 * matching. Everything else about building a statement stays on the dialect.
 *
 * A dialect supplies these as CLOSURES rather than passing itself, so that a subclass override is
 * resolved when the closure runs — and so this interface cannot grow into "the whole manager" by
 * accident.
 */
export interface ISqlDialectHooks {
  quoteIdentifier(name: string): string;
  getParamPlaceholder(index: number): string;
  normalizeParamValue(value: any): any;
  comparisonColumn(comparison: { operator: string; value: any }, quotedColumn: string): string;
  equalityColumnExpression(quotedColumn: string, value: any): string;
  patternColumnExpression(quotedColumn: string): string;
  getLikeOperator(): string;
  resolveColumn(column: string, tableOrName?: any): any;
  drizzlePatternColumn(column: any): any;
}
