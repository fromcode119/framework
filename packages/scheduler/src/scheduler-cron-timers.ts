import cron, { ScheduledTask } from 'node-cron';
import { SchedulerRunClaim } from '@scheduler/scheduler-run-claim';

/** This instance's cron timers, one per task, and when each next fires. */
export class SchedulerCronTimers {
  private readonly jobs: Map<string, ScheduledTask> = new Map();

  constructor(
    private readonly onFire: (name: string, slotMs: number) => Promise<void>,
    private readonly logger: { error(message: string): void; debug(message: string): void },
  ) {}

  /** Sets up (or restarts) a task's timer; false when the expression is not one cron accepts. */
  set(name: string, schedule: string): boolean {
    this.stop(name);
    if (!cron.validate(schedule)) {
      this.logger.error(`Invalid cron expression for task "${name}": ${schedule}`);
      return false;
    }
    // Same reasoning as the pulse timer: a cron callback has no caller. runTask() catches today, but
    // nothing structural keeps it that way, and the cost of it changing is a dead process.
    const slotMs = SchedulerRunClaim.slotMsFor(schedule);
    this.jobs.set(name, cron.schedule(schedule, () => {
      this.onFire(name, slotMs).catch((error: unknown) => {
        this.logger.error(`Cron task "${name}" rejected: ${error instanceof Error ? error.message : String(error)}`);
      });
    }));
    this.logger.debug(`Set up cron job for "${name}": ${schedule}`);
    return true;
  }

  stop(name: string): void {
    this.jobs.get(name)?.stop();
    this.jobs.delete(name);
  }

  stopAll(): void {
    for (const job of this.jobs.values()) job.stop();
    this.jobs.clear();
  }

  nextRun(name: string): Date | null {
    return this.jobs.get(name)?.getNextRun() ?? null;
  }
}
