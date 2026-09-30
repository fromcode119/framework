import type { AggregateFunction } from '@database/enums/aggregate-function.enum';

/** One computed value per group, returned under `as`. */
export interface IAggregateMeasure {
  fn: AggregateFunction;
  /** The canonical (camelCase) field; omitted only for a plain `COUNT`. */
  column?: string;
  /** The key the value is returned under — a plain identifier. */
  as: string;
}
