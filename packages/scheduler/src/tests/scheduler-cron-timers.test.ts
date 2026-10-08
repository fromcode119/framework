import { afterEach, describe, expect, it } from 'vitest';
import { SchedulerCronTimers } from '@scheduler/scheduler-cron-timers';

/**
 * node-cron 4.2 answered a weekday schedule's next run a YEAR out (`0 9 * * 1` → 2029-01-01), and its
 * runner sleeps toward that answer a day at a time, checking only the minute it wakes — so a task
 * that runs on a weekday never ran. The timers must name the real next firing.
 */
describe('SchedulerCronTimers', () => {
  const timers = new SchedulerCronTimers(async () => undefined, { error: () => undefined, debug: () => undefined });
  afterEach(() => timers.stopAll());

  it('names the coming weekday for a weekly schedule, not a date years away', () => {
    timers.set('weekly', '0 9 * * 1');
    const next = timers.nextRun('weekly')!;

    expect(next.getTime() - Date.now()).toBeLessThanOrEqual(7 * 86_400_000);
    expect(next.getDay()).toBe(1);
    expect([next.getHours(), next.getMinutes()]).toEqual([9, 0]);
  });

  it('refuses an expression cron does not accept', () => {
    expect(timers.set('broken', 'not a schedule')).toBe(false);
    expect(timers.nextRun('broken')).toBeNull();
  });
});
