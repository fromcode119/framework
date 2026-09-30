import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * The calendar units a timestamp column is bucketed into. A week starts on Monday (ISO 8601).
 *
 * The `.value` is also Postgres's `date_trunc` field name, and what crosses a plugin's sandbox.
 */
export class AggregateBucketUnit extends Enum {
  static readonly HOUR = new AggregateBucketUnit('hour');
  static readonly DAY = new AggregateBucketUnit('day');
  static readonly WEEK = new AggregateBucketUnit('week');
  static readonly MONTH = new AggregateBucketUnit('month');

  private constructor(value: string) {
    super(value);
  }
}
