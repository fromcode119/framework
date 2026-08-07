/**
 * WhereComparison - one resolved `where` predicate: a column, an operator, and an operand.
 *
 * `where` values are either a literal (meaning equality) or an operator object
 * (`{ gte: from, lte: to }`). Both shapes are parsed into this one form so the raw-SQL builders and
 * the drizzle builders emit the SAME set of predicates from the same parse, instead of each
 * re-interpreting the caller's object.
 */
export class WhereComparison {
  readonly column: string;
  readonly operator: string;
  readonly value: any;

  constructor(column: string, operator: string, value: any) {
    this.column = column;
    this.operator = operator;
    this.value = value;
  }

  /** The SQL comparison operator for this predicate (`=`, `<>`, `>`, `>=`, `<`, `<=`). */
  get sqlOperator(): string {
    return WhereComparison.SQL_OPERATORS[this.operator];
  }

  /** Canonical operator name -> SQL operator. The key set is also what `where` accepts. */
  static readonly SQL_OPERATORS: Record<string, string> = {
    eq: '=',
    ne: '<>',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  };

  static isOperatorName(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(WhereComparison.SQL_OPERATORS, name);
  }
}
