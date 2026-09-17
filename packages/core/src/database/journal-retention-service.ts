import { CoercionUtils } from '@core/utils/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import type { IJournalRetentionTarget } from '@core/database/journal-retention-target';

/**
 * Prunes the platform's JOURNALS to the windows their operator declared.
 *
 * `_system_logs` had no retention of any kind and grew without bound; `_system_audit_logs` still has
 * none. Volume is not only disk — a WARN stream that never ends buries the warnings an operator
 * actually needs to see.
 *
 * Each window is a DECLARED setting, never a constant in here: empty or zero means KEEP FOREVER and
 * nothing is pruned. There is deliberately no code-level fallback number — a platform that silently
 * started deleting an operator's security history because a service picked 30 days is exactly the
 * invented default this codebase forbids. Where a journal declares a `minimumDays`, a shorter window
 * is REFUSED with the reason, which is a visible rule rather than a silent clamp.
 *
 * THE SWEEP IS PLATFORM-WIDE, AND MUST SAY SO TO THE DATABASE. These tables carry a `tenant_id` and
 * the journal policy's USING clause is
 * `tenant_id = current OR app.platform_admin = 'on' OR (tenant_id IS NULL AND current IS NULL)`.
 * This service runs on an untenanted connection, so without the platform marker the DELETE matched
 * only `tenant_id IS NULL` rows — it pruned the platform's own stream and NEVER any site's, silently,
 * because RLS narrows rather than errors. Every hosted site's logs grew without bound while the
 * retention setting appeared to be working. `withPlatformAdmin` is also the only branch that reaches
 * rows whose tenant has since been deleted; a per-tenant loop cannot.
 *
 * The delete is BATCHED. One `DELETE ... RETURNING *` over a year of every site's history holds row
 * locks for the whole statement and streams every deleted row back into Node. The first sweep after
 * an operator sets a window is exactly when that backlog is largest.
 */
export class JournalRetentionService {
  private static readonly MILLISECONDS_PER_DAY = 86_400_000;
  private static readonly SWEEP_INTERVAL_MS = 86_400_000;
  /** How many ids to remove per statement. Small enough that no single DELETE holds locks for long. */
  private static readonly DELETE_BATCH = 1000;

  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly db: any,
    private readonly logger: { info(message: string): void; error(message: string, error?: unknown): void },
    private readonly targets: IJournalRetentionTarget[],
  ) {}

  /**
   * Prune once now, then daily. Boot alone is not enough — an API that stays up for weeks would never
   * prune, which is the case that lets a table run away in the first place.
   */
  start(): void {
    void this.pruneAll();

    this.sweepTimer = setInterval(() => {
      void this.pruneAll();
    }, JournalRetentionService.SWEEP_INTERVAL_MS);

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

  /** Every declared journal, in order. One journal's failure must not stop the next. */
  async pruneAll(): Promise<number> {
    let removed = 0;
    for (const target of this.targets) {
      removed += await this.pruneFromSettings(target);
    }
    return removed;
  }

  /**
   * Read one journal's declared window and prune to it. Returns the number of rows removed.
   *
   * `start()` fires this without awaiting it, so a rejection here would escape as an unhandled
   * rejection and kill the process (it did: a DB without `_system_meta` crashed the api test run).
   * An unreadable settings read means "no retention configured" — prune nothing.
   */
  async pruneFromSettings(target: IJournalRetentionTarget): Promise<number> {
    let retentionDays: number;
    try {
      retentionDays = await this.readRetentionDays(target);
    } catch (error) {
      this.logger.error(`[Retention:${target.label}] Failed to read the retention setting; pruning nothing`, error);
      return 0;
    }

    if (retentionDays <= 0) {
      return 0;
    }

    // REFUSED, not clamped. Giving an operator who asked for 30 days a silent 180 would leave them
    // believing they had 30; the floor only works as a rule if it is visible when it bites.
    const floor = target.minimumDays ?? 0;
    if (floor > 0 && retentionDays < floor) {
      this.logger.error(
        `[Retention:${target.label}] Refusing to prune: ${retentionDays} day(s) is below the ${floor}-day minimum`
        + ` for ${target.table}. Nothing was removed. Set ${target.settingKey} to ${floor} or more, or clear it to keep forever.`,
      );
      return 0;
    }

    return this.pruneOlderThan(target, retentionDays);
  }

  async pruneOlderThan(target: IJournalRetentionTarget, retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - (retentionDays * JournalRetentionService.MILLISECONDS_PER_DAY));
    const where = { [target.timestampField]: { lt: cutoff.toISOString() } };

    try {
      // ONE platform-admin scope around the count, the breakdown and every batch: the marker is bound
      // to the pinned client, so a delete issued outside it silently falls back to `tenant_id IS NULL`.
      return await this.db.withPlatformAdmin(async () => {
        const planned = await this.db.count(target.table, { where });
        if (planned <= 0) {
          return 0;
        }

        // Said BEFORE anything is removed, and broken down by site. This is a destructive sweep whose
        // first run after an operator sets a window can clear a long backlog; an operator reading the
        // log afterwards must be able to see whose rows went, not just a total.
        const owners = await this.describeOwners(target, where);
        this.logger.info(
          `[Retention:${target.label}] Pruning ${planned} row(s) from ${target.table} older than ${retentionDays} day(s)`
          + ` (before ${cutoff.toISOString()}) across ${owners}.`,
        );

        const removed = await this.deleteInBatches(target, where);
        this.logger.info(`[Retention:${target.label}] Removed ${removed} row(s).`);

        // A journal that IS the record of what happened must record its own pruning. Failing to write
        // that entry must not un-delete the rows or crash the sweep, so it is logged and swallowed.
        if (target.afterPrune) {
          try {
            await target.afterPrune({
              table: target.table, retentionDays, cutoff: cutoff.toISOString(), planned, removed, owners,
            });
          } catch (error) {
            this.logger.error(`[Retention:${target.label}] Pruned, but failed to record the prune`, error);
          }
        }

        return removed;
      });
    } catch (error) {
      this.logger.error(`[Retention:${target.label}] Failed to prune ${target.table}`, error);
      return 0;
    }
  }

  /**
   * Who owns the rows about to go, as `platform=41044, hub=16`.
   *
   * Grouped in the DATABASE, read inside the caller's platform-admin scope. Counted from the rows
   * themselves rather than from the tenant list, so a row whose tenant no longer exists is still
   * reported instead of vanishing unattributed.
   */
  private async describeOwners(target: IJournalRetentionTarget, where: Record<string, unknown>): Promise<string> {
    const groups: Array<Record<string, any>> = await this.db.groupCount(target.table, { where, groupBy: ['tenant_id'] });
    return groups
      .map((group) => `${group?.tenant_id ? String(group.tenant_id) : 'platform'}=${CoercionUtils.toNumber(group?.count, 0)}`)
      .join(', ');
  }

  /**
   * Delete by id, a batch at a time, until nothing older than the cutoff is left.
   *
   * Returns what was ACTUALLY removed. The old code reported its pre-count, so a delete that removed
   * fewer rows than it counted — which is precisely what RLS was doing — still logged the full number.
   */
  private async deleteInBatches(target: IJournalRetentionTarget, where: Record<string, unknown>): Promise<number> {
    let removed = 0;

    for (;;) {
      // `columns`, not `select` — `find` has no `select` option, so the projection was silently
      // dropped and every batch pulled WHOLE journal rows (message, context, metadata) to read one
      // id from each. Harmless in outcome, wasteful at the size these tables reach.
      const batch: Array<Record<string, any>> = await this.db.find(target.table, {
        where,
        columns: { id: true },
        limit: JournalRetentionService.DELETE_BATCH,
      });
      const ids = batch.map((row) => row?.id).filter((id) => id !== undefined && id !== null);
      // `delete` refuses an empty filter, and an empty batch is the exit condition anyway.
      if (ids.length === 0) {
        return removed;
      }

      await this.db.delete(target.table, { id: { in: ids } });
      removed += ids.length;

      // A short batch means the table is drained; one more round trip would only confirm it.
      if (ids.length < JournalRetentionService.DELETE_BATCH) {
        return removed;
      }
    }
  }

  private async readRetentionDays(target: IJournalRetentionTarget): Promise<number> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: target.settingKey });
    return Math.max(0, Math.floor(CoercionUtils.toNumber(row?.value, 0)));
  }
}
