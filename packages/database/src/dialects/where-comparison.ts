/**
 * WhereComparison - one resolved `where` predicate: a column, an operator, and an operand.
 *
 * `where` values are either a literal (meaning equality) or an operator object
 * (`{ gte: from, lte: to }`). Both shapes are parsed into this one form so the raw-SQL builders and
 * the drizzle builders emit the SAME set of predicates from the same parse, instead of each
 * re-interpreting the caller's object.
 *
 * Three KINDS of operator, because they render differently:
 *   - comparison (`eq`, `lt`, …) — one operand, one placeholder.
 *   - set (`in`, `notIn`) — a list of operands and therefore a list of placeholders.
 *   - pattern (`contains`, `startsWith`, `endsWith`) — one operand, wrapped in wildcards and matched
 *     case-insensitively where the dialect can (Postgres ILIKE).
 *
 * Callers used to have neither a set nor a pattern operator, so a filter over several values or a name
 * search could not be expressed in SQL at all and every caller fetched rows and filtered them in
 * memory — which is slower, and silently WRONG past the fetch limit.
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

  /** Canonical operator name -> SQL operator, for the one-operand comparisons. */
  static readonly SQL_OPERATORS: Record<string, string> = {
    eq: '=',
    ne: '<>',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  };

  /** Set membership. The operand is a LIST, so these render a placeholder per element. */
  static readonly SET_OPERATORS: Record<string, string> = {
    in: 'IN',
    notIn: 'NOT IN',
  };

  /** Substring matching. The operand is wrapped in wildcards by the dialect, never by the caller. */
  static readonly PATTERN_OPERATORS: Record<string, 'contains' | 'startsWith' | 'endsWith'> = {
    contains: 'contains',
    startsWith: 'startsWith',
    endsWith: 'endsWith',
  };

  get isSet(): boolean {
    return Object.prototype.hasOwnProperty.call(WhereComparison.SET_OPERATORS, this.operator);
  }

  get isPattern(): boolean {
    return Object.prototype.hasOwnProperty.call(WhereComparison.PATTERN_OPERATORS, this.operator);
  }

  /** The operand as a list. A set operator given a single value means a set of one, not an error. */
  get values(): any[] {
    return Array.isArray(this.value) ? this.value : [this.value];
  }

  static isOperatorName(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(WhereComparison.SQL_OPERATORS, name)
      || Object.prototype.hasOwnProperty.call(WhereComparison.SET_OPERATORS, name)
      || Object.prototype.hasOwnProperty.call(WhereComparison.PATTERN_OPERATORS, name);
  }

  /**
   * The escape character used with LIKE, and the reason it is not a backslash.
   *
   * A backslash is ALREADY an escape character inside a MySQL string literal, so `ESCAPE '\\'` has to be
   * written differently there than in Postgres or SQLite — one shared builder cannot emit one literal
   * that means the same thing in all three. `!` is not special in any of their string literals, so the
   * same clause is correct everywhere. It is escaped in the pattern below like the wildcards are, so a
   * user searching for "!" still matches the literal character.
   */
  static readonly LIKE_ESCAPE = '!';

  /**
   * The LIKE operand for a pattern operator, with the wildcards the USER typed neutralised.
   *
   * `%` and `_` are wildcards in SQL LIKE. Searching for "50%" or "draft_1" would otherwise match far
   * more than the operator asked for — a silently wrong result set rather than an error.
   */
  /**
   * Neutralise the LIKE wildcards a USER typed, so their text matches itself.
   *
   * Shared with the `search` option, which had the same hole: a visitor typing "%" into a search box
   * matched EVERY row, and one typing "50%" matched far more than they asked for.
   */
  static escapeLikeOperand(value: unknown): string {
    return String(value ?? '').replace(
      new RegExp(`[${WhereComparison.LIKE_ESCAPE}%_]`, 'g'),
      (character) => `${WhereComparison.LIKE_ESCAPE}${character}`,
    );
  }

  get likePattern(): string {
    const escaped = WhereComparison.escapeLikeOperand(this.value);
    if (this.operator === 'startsWith') return `${escaped}%`;
    if (this.operator === 'endsWith') return `%${escaped}`;
    return `%${escaped}%`;
  }
}
