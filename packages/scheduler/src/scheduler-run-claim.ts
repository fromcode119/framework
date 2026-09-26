import type { IDatabaseManager } from '@fromcode119/database';

/**
 * Makes ONE api instance run each scheduled firing, however many are up.
 *
 * Every instance keeps its own cron timers and interval pulse, and they fire together. That was harmless
 * with one api, but two run side by side during a rolling deploy (and whenever more are scaled up), and
 * then a reminder email, a report or a billing sweep went out once per instance. Each firing is now
 * CLAIMED in the task's row before it runs, with an update that only matches the row as it was read:
 * the first instance's update wins, every other instance's matches nothing and skips.
 */
export class SchedulerRunClaim {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly table: string,
  ) {}

  /**
   * One firing of a cron task. `slotMs` is the schedule's granularity: an instance that reads the row
   * after another has already claimed this slot sees `last_run` inside it and skips, which the
   * optimistic update alone would not catch (its token was already bumped when it read it).
   */
  async claimCron(name: string, firedAt: Date, slotMs: number): Promise<boolean> {
    let row = await this.db.findOne(this.table, { name });
    // Nothing to coordinate on: the task is registered in memory only, exactly as before.
    if (!row) return true;
    const slotStart = Math.floor(firedAt.getTime() / slotMs) * slotMs;
    if (row.last_run && new Date(row.last_run).getTime() >= slotStart) return false;
    // `updated_at` is the claim token; a row that never had one gets one first, then is read again.
    if (!row.updated_at) {
      await this.db.update(this.table, { name }, { updated_at: new Date() });
      row = await this.db.findOne(this.table, { name });
      if (!row?.updated_at) return false;
    }
    // `last_run` records the FIRING, not the moment of the write, so the slot test above is exact.
    const claimed = await this.db.update(this.table, { name, updated_at: row.updated_at }, { last_run: firedAt, updated_at: new Date() });
    return Boolean(claimed);
  }

  /** One due run of an interval task: whoever moves `next_run` forward from the value read runs it. */
  async claimInterval(name: string, dueAt: unknown, nextRun: Date): Promise<boolean> {
    const claimed = await this.db.update(this.table, { name, next_run: dueAt }, { last_run: new Date(), next_run: nextRun });
    return Boolean(claimed);
  }

  /** A 6-field cron expression fires on seconds; the usual 5-field one on minutes. */
  static slotMsFor(schedule: string): number {
    return String(schedule ?? '').trim().split(/\s+/).length >= 6 ? 1000 : 60_000;
  }
}
