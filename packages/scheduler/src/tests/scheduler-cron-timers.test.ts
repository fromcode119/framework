import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('gives each task its own fixed offset within the spread window, so a quarter hour does not fire them all at once', () => {
    const names = ['ecommerce-price-history-check', 'ecommerce-public-cards', 'cms-normalise-stored-values', 'finance-normalise-stored-values', 'certificate-issuance', 'platform-monitor'];
    const offsets = names.map((name) => SchedulerCronTimers.offsetMs(name, 60_000));
    for (const offset of offsets) {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(SchedulerCronTimers.SPREAD_MS);
    }
    // The same task is always at the same offset; they are not all the same.
    expect(names.map((name) => SchedulerCronTimers.offsetMs(name, 60_000))).toEqual(offsets);
    expect(new Set(offsets).size).toBeGreaterThan(3);
  });

  it('does not delay a seconds schedule', () => {
    expect(SchedulerCronTimers.offsetMs('every-20-seconds', 1000)).toBe(0);
  });

  it('cancels a run that is still waiting out its offset when its task is stopped', () => {
    vi.useFakeTimers();
    try {
      const ran: string[] = [];
      const local = new SchedulerCronTimers(async (name) => { ran.push(name); }, { error: () => undefined, debug: () => undefined });
      // What a cron tick does for a task with an offset: wait, then run.
      const waiting = new Set<NodeJS.Timeout>();
      (local as any).pending.set('quarter-task', waiting);
      waiting.add(setTimeout(() => ran.push('quarter-task'), SchedulerCronTimers.offsetMs('quarter-task', 60_000)));
      local.stop('quarter-task');
      vi.advanceTimersByTime(SchedulerCronTimers.SPREAD_MS);
      expect(ran).toEqual([]);
      expect((local as any).pending.has('quarter-task')).toBe(false);
    } finally { vi.useRealTimers(); }
  });

});
