import { Enum } from '@fromcode119/reactor';

/** How a scheduled task repeats. */
export class ScheduleType extends Enum {
  static readonly CRON = new ScheduleType('cron');
  static readonly INTERVAL = new ScheduleType('interval');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve a raw value to a member; defaults to CRON.
   *
   * A task's type comes back from the DB as a plain string, and plugins pass it through
   * `context.scheduler.register({ type })` — comparing either to a member with `===` is always false.
   */
  static resolve(value: unknown): ScheduleType {
    if (value instanceof ScheduleType) return value;
    // Strip surrounding double quotes before matching. Rows written before the enum was serialised by
    // VALUE hold the JSON form `"interval"`; without this they fail to match any member and fall back
    // to CRON below, which is how a `2m` interval task ended up being validated as a cron expression.
    // Tolerating it here heals those rows on read, so no data migration is needed.
    const raw = String(value ?? '').trim().replace(/^"(.*)"$/, '$1').toLowerCase();
    const found = ScheduleType.fromValue(raw);
    return (found as ScheduleType | undefined) ?? ScheduleType.CRON;
  }
}
