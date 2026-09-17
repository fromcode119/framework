import type { WhereComparison } from '@database/dialects/where-comparison';

/**
 * What `RawStatementBuilder` needs from the dialect underneath it.
 *
 * Wider than `ISqlDialectHooks` by one entry — a grouped count needs to know how this driver turns a
 * timestamp into its day — and it reuses the predicate renderer rather than re-deriving predicates,
 * which is why `renderPredicate` is here rather than the nine hooks that produce it.
 */
export interface IRawStatementHooks {
  quoteIdentifier(name: string): string;
  getParamPlaceholder(index: number): string;
  getLikeOperator(): string;
  patternColumnExpression(quotedColumn: string): string;
  dayBucketExpression(quotedColumn: string): string;
  renderPredicate(comparison: WhereComparison, quotedColumn: string, values: any[]): string;
}
