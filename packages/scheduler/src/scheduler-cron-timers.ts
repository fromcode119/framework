import cron, { ScheduledTask } from 'node-cron';
import { SchedulerRunClaim } from '@scheduler/scheduler-run-claim';

/** This instance's cron timers, one per task, and when each next fires. */
export class SchedulerCronTimers {
  /**
   * How long into its minute a task may wait before it runs. Every task of a schedule fires at the same
   * instant — on a quarter hour that is twenty tasks at once, all asking the same plugin process and the
   * same database while visitors are being served, and the storefront stalled for seconds each time. Each
   * task waits a fixed part of this window instead, taken from its own name, so the same task always
   * runs at the same offset and the load spreads across the minute.
   */
  static readonly SPREAD_MS = 40_000;
  private readonly jobs: Map<string, ScheduledTask> = new Map();
  /** A task's run that is waiting out its offset, so stopping the task also cancels it. */
  private readonly pending: Map<string, Set<NodeJS.Timeout>> = new Map();

  constructor(
    private readonly onFire: (name: string, slotMs: number, firedAt: Date) => Promise<void>,
    private readonly logger: { error(message: string): void; debug(message: string): void },
  ) {}

  /** The wait before a task runs: a fixed share of `SPREAD_MS` from its name; none for a seconds schedule. */
  static offsetMs(name: string, slotMs: number): number {
    if (slotMs < 60_000) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return hash % SchedulerCronTimers.SPREAD_MS;
  }

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
    const offset = SchedulerCronTimers.offsetMs(name, slotMs);
    this.jobs.set(name, cron.schedule(schedule, () => {
      // The firing is the tick's moment, not the moment the task runs: the slot a run claims is that of the tick.
      const firedAt = new Date();
      const run = () => {
        this.onFire(name, slotMs, firedAt).catch((error: unknown) => {
          this.logger.error(`Cron task "${name}" rejected: ${error instanceof Error ? error.message : String(error)}`);
        });
      };
      if (offset === 0) return run();
      const waiting = this.pending.get(name) ?? new Set<NodeJS.Timeout>();
      this.pending.set(name, waiting);
      const timer = setTimeout(() => { waiting.delete(timer); run(); }, offset);
      waiting.add(timer);
    }));
    this.logger.debug(`Set up cron job for "${name}": ${schedule}`);
    return true;
  }

  stop(name: string): void {
    this.jobs.get(name)?.stop();
    this.jobs.delete(name);
    for (const timer of this.pending.get(name) ?? []) clearTimeout(timer);
    this.pending.delete(name);
  }

  stopAll(): void {
    for (const job of this.jobs.values()) job.stop();
    this.jobs.clear();
    for (const waiting of this.pending.values()) for (const timer of waiting) clearTimeout(timer);
    this.pending.clear();
  }

  nextRun(name: string): Date | null {
    return this.jobs.get(name)?.getNextRun() ?? null;
  }
}
