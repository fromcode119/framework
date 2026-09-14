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
 *
 * THE SWEEP IS PLATFORM-WIDE, AND MUST SAY SO TO THE DATABASE. `_system_logs` carries a `tenant_id`
 * and the journal policy's USING clause is
 * `tenant_id = current OR app.platform_admin = 'on' OR (tenant_id IS NULL AND current IS NULL)`.
 * This service runs on an untenanted connection, so without the platform marker the DELETE matched
 * only `tenant_id IS NULL` rows — it pruned the platform's own stream and NEVER any site's, silently,
 * because RLS narrows rather than errors. Every hosted site's logs grew without bound while the
 * operator's retention setting appeared to be working. `withPlatformAdmin` is the only branch that
 * also reaches rows whose tenant has since been deleted; a per-tenant loop cannot.
 *
 * The delete is BATCHED. One `DELETE ... RETURNING *` over a year of every site's history holds row
 * locks for the whole statement and streams every deleted row back into Node. The first sweep after
 * an upgrade is exactly when that backlog is largest.
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

  /** How many ids to remove per statement. Small enough that no single DELETE holds locks for long. */
  private static readonly DELETE_BATCH = 1000;

  async pruneOlderThan(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - (retentionDays * SystemLogRetentionService.MILLISECONDS_PER_DAY));
    const where = { timestamp: { lt: cutoff.toISOString() } };

    try {
      // ONE platform-admin scope around the count, the breakdown and every batch: the marker is bound
      // to the pinned client, so a delete issued outside it silently falls back to `tenant_id IS NULL`.
      return await this.db.withPlatformAdmin(async () => {
        const doomed = await this.db.count(SystemConstants.TABLE.LOGS, { where });
        if (doomed <= 0) {
          return 0;
        }

        // Said BEFORE anything is removed, and broken down by site. This is a destructive sweep whose
        // first run after an upgrade can clear a long backlog; an operator reading the log afterwards
        // must be able to see whose rows went, not just a total.
        this.logger.info(
          `[LogRetention] Pruning ${doomed} log row(s) older than ${retentionDays} day(s)`
          + ` (before ${cutoff.toISOString()}) across ${await this.describeOwners(where)}.`,
        );

        const removed = await this.deleteInBatches(where);
        this.logger.info(`[LogRetention] Removed ${removed} log row(s).`);
        return removed;
      });
    } catch (error) {
      this.logger.error('[LogRetention] Failed to prune system logs', error);
      return 0;
    }
  }

  /**
   * Who owns the rows about to go, as `platform=41044, hub=16, …`.
   *
   * Read inside the caller's platform-admin scope. Counted from the rows themselves rather than from
   * the tenant list, so a row whose tenant no longer exists is still reported instead of vanishing
   * unattributed.
   */
  private async describeOwners(where: Record<string, unknown>): Promise<string> {
    const rows: Array<Record<string, any>> = await this.db.find(SystemConstants.TABLE.LOGS, { where, select: ['tenant_id'] });
    const byOwner = new Map<string, number>();
    for (const row of rows) {
      const owner = row?.tenant_id ? String(row.tenant_id) : 'platform';
      byOwner.set(owner, (byOwner.get(owner) ?? 0) + 1);
    }
    return [...byOwner.entries()].map(([owner, count]) => `${owner}=${count}`).join(', ');
  }

  /**
   * Delete by id, a batch at a time, until nothing older than the cutoff is left.
   *
   * Returns what was ACTUALLY removed. The old code reported its pre-count, so a delete that removed
   * fewer rows than it counted — which is precisely what RLS was doing — still logged the full number.
   */
  private async deleteInBatches(where: Record<string, unknown>): Promise<number> {
    let removed = 0;

    for (;;) {
      const batch: Array<Record<string, any>> = await this.db.find(SystemConstants.TABLE.LOGS, {
        where,
        select: ['id'],
        limit: SystemLogRetentionService.DELETE_BATCH,
      });
      const ids = batch.map((row) => row?.id).filter((id) => id !== undefined && id !== null);
      // `delete` refuses an empty filter, and an empty batch is the exit condition anyway.
      if (ids.length === 0) {
        return removed;
      }

      await this.db.delete(SystemConstants.TABLE.LOGS, { id: { in: ids } });
      removed += ids.length;

      // A short batch means the table is drained; one more round trip would only confirm it.
      if (ids.length < SystemLogRetentionService.DELETE_BATCH) {
        return removed;
      }
    }
  }

  private async readRetentionDays(): Promise<number> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.LOG_RETENTION_DAYS });
    return Math.max(0, Math.floor(CoercionUtils.toNumber(row?.value, 0)));
  }
}
