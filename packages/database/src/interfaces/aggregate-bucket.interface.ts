import type { AggregateBucketUnit } from '@database/enums/aggregate-bucket-unit.enum';

/**
 * A timestamp column grouped by calendar unit. `timeZone` is an IANA zone (`Europe/Sofia`); Postgres
 * buckets in that zone, SQLite and MySQL in UTC — see `IAggregateOptions`.
 */
export interface IAggregateBucket {
  column: string;
  unit: AggregateBucketUnit;
  timeZone?: string;
}
