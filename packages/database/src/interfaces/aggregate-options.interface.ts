import type { IAggregateBucket } from '@database/interfaces/aggregate-bucket.interface';
import type { IAggregateMeasure } from '@database/interfaces/aggregate-measure.interface';
import type { IAggregateOrder } from '@database/interfaces/aggregate-order.interface';

/**
 * Options for `IDatabaseManager.aggregate` — grouped SQL aggregation for a string-named table.
 *
 * Postgres buckets in `bucket.timeZone`; SQLite and MySQL bucket in UTC, because neither can convert
 * zones without extra setup — a caller that needs local calendar days runs on Postgres, which is what
 * every deployment uses.
 */
export interface IAggregateOptions {
  where?: any;
  groupBy?: string[];
  bucket?: IAggregateBucket;
  measures: IAggregateMeasure[];
  /** Default: `bucket` ascending, else the first measure descending. */
  orderBy?: IAggregateOrder;
  limit?: number;
  offset?: number;
}
