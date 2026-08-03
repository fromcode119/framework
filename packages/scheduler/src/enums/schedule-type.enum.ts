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
    const found = ScheduleType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ScheduleType | undefined) ?? ScheduleType.CRON;
  }
}
