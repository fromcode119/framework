/** The aggregate functions `aggregate` computes in SQL. `count` without a column is `COUNT(*)`. */
export type AggregateFunction = 'count' | 'countDistinct' | 'sum' | 'avg' | 'min' | 'max';

/** The calendar units a timestamp column is bucketed into. A week starts on Monday (ISO 8601). */
export type AggregateBucketUnit = 'hour' | 'day' | 'week' | 'month';

/** One computed value per group, returned under `as`. */
export interface IAggregateMeasure {
  fn: AggregateFunction;
  /** The canonical (camelCase) field; omitted only for a plain `count`. */
  column?: string;
  /** The key the value is returned under — a plain identifier. */
  as: string;
}

/**
 * Options for `IDatabaseManager.aggregate` — grouped SQL aggregation for a string-named table.
 *
 * `bucket.timeZone` is an IANA zone (`Europe/Sofia`). Postgres buckets in that zone; SQLite and MySQL
 * bucket in UTC, because neither can convert zones without extra setup — a caller that needs local
 * calendar days runs on Postgres, which is what every deployment uses.
 */
export interface IAggregateOptions {
  where?: any;
  groupBy?: string[];
  bucket?: { column: string; unit: AggregateBucketUnit; timeZone?: string };
  measures: IAggregateMeasure[];
  /** A measure's `as`, a `groupBy` field, or `bucket`. Default: `bucket` ascending, else the first measure descending. */
  orderBy?: { by: string; direction?: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}
