import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Prunes `_system_logs` to the operator's declared retention window.
 *
 * `_system_logs` had NO retention of any kind: `PluginStateService.writeLog` is the only writer and
 * nothing ever deleted a row, so the table grew without bound (130k INFO / 9.9k WARN / 1k ERROR on a
 * single dev box). The volume is not just disk — a WARN stream that never ends buries the warnings an
 * operator actually needs to see.
 *
 * The window is a DECLARED setting (`SystemConstants.META_KEY.LOG_RETENTION_DAYS`), not a constant in
 * here: an empty or zero value means KEEP FOREVER and nothing is pruned. There is deliberately no
 * code-level fallback number — a platform that silently started deleting an operator's audit history
 * because a service picked 30 days is exactly the invented default this codebase forbids.
 */
export class SystemLogRetentionService {
  private static readonly MILLISECONDS_PER_DAY = 86_400_000;
  private static readonly SWEEP_INTERVAL_MS = 86_400_000;

  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly db: any,
    private readonly logger: { info(message: string): void; error(message: string, error?: unknown): void },
  ) {}

  /**
   * Prune once now, then daily. Boot alone is not enough — an API that stays up for weeks would never
   * prune, which is the case that lets the table run away in the first place.
   */
  start(): void {
    void this.pruneFromSettings();

    this.sweepTimer = setInterval(() => {
      void this.pruneFromSettings();
    }, SystemLogRetentionService.SWEEP_INTERVAL_MS);

    // Never hold the process open for a log sweep.
    this.sweepTimer.unref?.();
  }

  stop(): void {
    if (!this.sweepTimer) {
      return;
    }

    clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  /**
   * Read the declared window and prune to it. Returns the number of rows removed.
   *
   * `start()` fires this without awaiting it, so a rejection here would escape as an unhandled
   * rejection and kill the process (it did: a DB without `_system_meta` crashed the api test run).
   * An unreadable settings read means "no retention configured" — prune nothing.
   */
  async pruneFromSettings(): Promise<number> {
    let retentionDays: number;
    try {
      retentionDays = await this.readRetentionDays();
    } catch (error) {
      this.logger.error('[LogRetention] Failed to read the retention setting; pruning nothing', error);
      return 0;
    }

    if (retentionDays <= 0) {
      return 0;
    }

    return this.pruneOlderThan(retentionDays);
  }

  async pruneOlderThan(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - (retentionDays * SystemLogRetentionService.MILLISECONDS_PER_DAY));
    const where = { timestamp: { lt: cutoff.toISOString() } };

    try {
      const doomed = await this.db.count(SystemConstants.TABLE.LOGS, { where });
      if (doomed <= 0) {
        return 0;
      }

      await this.db.delete(SystemConstants.TABLE.LOGS, where);
      this.logger.info(
        `[LogRetention] Removed ${doomed} log row(s) older than ${retentionDays} day(s) (before ${cutoff.toISOString()}).`,
      );
      return doomed;
    } catch (error) {
      this.logger.error('[LogRetention] Failed to prune system logs', error);
      return 0;
    }
  }

  private async readRetentionDays(): Promise<number> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.LOG_RETENTION_DAYS });
    return Math.max(0, Math.floor(CoercionUtils.toNumber(row?.value, 0)));
  }
}
