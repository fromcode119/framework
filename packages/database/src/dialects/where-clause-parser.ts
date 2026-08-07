import { WhereComparison } from '@database/dialects/where-comparison';

/**
 * WhereClauseParser - turns a `where` object into an explicit list of comparisons.
 *
 * A `where` VALUE is one of two things:
 *
 *   - a LITERAL, meaning equality — `{ status: 'paid' }`. A literal may itself be an object, because a
 *     JSON column is filtered by its JSON value.
 *   - an OPERATOR EXPRESSION — `{ createdAt: { gte: from, lte: to } }`, which is the only way to
 *     express a range. Every key must be a known operator (see `WhereComparison.SQL_OPERATORS`).
 *
 * Telling them apart is deliberately strict, because guessing wrong silently changes what a query
 * means. An object whose keys are ALL operators is an operator expression; an object with NO operator
 * keys is a JSON literal; an object that MIXES them is neither, and raises rather than picking one —
 * that is what a typo (`{ gte: x, ltee: y }`) looks like, and silently treating it as a JSON literal
 * would drop the range and return unfiltered rows.
 */
export class WhereClauseParser {
  static isPlainObject(value: unknown): boolean {
    return !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
  }

  /**
   * Is this `where` value an operator expression rather than a literal?
   *
   * The single place the two shapes are told apart, so the value normalizer and the SQL builders can
   * never disagree about what a caller's object meant. Raises on a mixed object rather than guessing.
   */
  static isOperatorExpression(column: string, value: any): boolean {
    if (!WhereClauseParser.isPlainObject(value)) return false;

    const keys = Object.keys(value);
    const operatorKeys = keys.filter((key) => WhereComparison.isOperatorName(key));

    // No operator keys at all: a JSON literal compared for equality (the long-standing behaviour).
    if (operatorKeys.length === 0) return false;

    if (operatorKeys.length !== keys.length) {
      const unknown = keys.filter((key) => !WhereComparison.isOperatorName(key));
      throw new Error(
        `Invalid where clause for column "${column}": mixes operators (${operatorKeys.join(', ')}) ` +
        `with non-operator keys (${unknown.join(', ')}). Use either an operator object ` +
        `({ ${Object.keys(WhereComparison.SQL_OPERATORS).join(' | ')} }) or a literal value, not both.`
      );
    }

    return true;
  }

  /** Parse one column's `where` value into its comparisons. */
  static parseValue(column: string, value: any): WhereComparison[] {
    if (!WhereClauseParser.isOperatorExpression(column, value)) {
      return [new WhereComparison(column, 'eq', value)];
    }

    return Object.keys(value).map(
      (operator) => new WhereComparison(column, operator, (value as any)[operator])
    );
  }

  /** Parse a whole `where` object into a flat list of comparisons, in declaration order. */
  static parse(where: any): WhereComparison[] {
    if (!WhereClauseParser.isPlainObject(where)) return [];
    return Object.entries(where).flatMap(([column, value]) => WhereClauseParser.parseValue(column, value));
  }
}
