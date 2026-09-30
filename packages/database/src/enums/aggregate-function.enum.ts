import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * The functions `aggregate` computes in SQL. `COUNT` without a column is `COUNT(*)`.
 *
 * The `.value` is what crosses a plugin's sandbox (an Enum serialises to it), so the statement builder
 * resolves a measure's function with `fromValue` and rejects anything that is not one of these.
 */
export class AggregateFunction extends Enum {
  static readonly COUNT = new AggregateFunction('count', 'COUNT');
  static readonly COUNT_DISTINCT = new AggregateFunction('countDistinct', 'COUNT');
  static readonly SUM = new AggregateFunction('sum', 'SUM');
  static readonly AVG = new AggregateFunction('avg', 'AVG');
  static readonly MIN = new AggregateFunction('min', 'MIN');
  static readonly MAX = new AggregateFunction('max', 'MAX');

  private constructor(value: string, readonly sql: string) {
    super(value);
  }

  /** A count or a sum of no rows is 0; the average, minimum or maximum of no rows has no value. */
  get emptyValue(): number | null {
    return this === AggregateFunction.COUNT || this === AggregateFunction.COUNT_DISTINCT || this === AggregateFunction.SUM ? 0 : null;
  }
}
