import { AsyncLocalStorage } from 'async_hooks';
import type { IDatabaseManager } from '@fromcode119/database';
import { SchedulerRunStatus } from '@scheduler/enums/scheduler-run-status.enum';

/**
 * Writes down what each background job did: one row per run, with when it started and finished, how
 * long it took, and the error it ended with. Before this the scheduler kept only `last_run`, and a
 * failure went to the process log — what the platform was doing on its own could not be seen anywhere
 * an operator looks.
 *
 * A run in progress is known to the code it calls (`currentRunId`), so the per-site runs a plugin
 * task makes are filed under the pass that made them.
 *
 * The journal never decides the job's fate: a run whose row cannot be written still runs, and its
 * error still reaches the caller exactly as before.
 */
export class SchedulerRunJournal {
  static readonly TABLE = '_system_scheduler_runs';
  /** Long enough to read an error, short enough that one runaway message cannot bloat the table. */
  private static readonly ERROR_LIMIT = 2000;
  private static readonly scope = new AsyncLocalStorage<{ runId: number | null }>();

  constructor(private readonly db: IDatabaseManager) {}

  /** The run the calling code is part of, when it runs inside one. */
  static currentRunId(): number | null {
    return SchedulerRunJournal.scope.getStore()?.runId ?? null;
  }

  /** Runs `work` as one recorded run of `taskName`, under `parentId` when it is part of a larger pass. */
  async record<T>(input: { taskName: string; pluginSlug?: string | null; parentId?: number | null }, work: () => Promise<T>): Promise<T> {
    const started = Date.now();
    const runId = await this.open(input, started);
    try {
      const result = await SchedulerRunJournal.scope.run({ runId }, work);
      await this.close(runId, started, SchedulerRunStatus.SUCCEEDED, null);
      return result;
    } catch (error) {
      await this.close(runId, started, SchedulerRunStatus.FAILED, error);
      throw error;
    }
  }

  private async open(input: { taskName: string; pluginSlug?: string | null; parentId?: number | null }, started: number): Promise<number | null> {
    try {
      const row = await this.db.insert(SchedulerRunJournal.TABLE, {
        task_name: input.taskName,
        plugin_slug: input.pluginSlug || null,
        parent_id: input.parentId ?? null,
        status: SchedulerRunStatus.RUNNING.value,
        started_at: new Date(started),
      });
      const id = Number((Array.isArray(row) ? row[0] : row)?.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    } catch (error) {
      console.error('[scheduler]', `Could not record the start of "${input.taskName}": ${SchedulerRunJournal.message(error)}`);
      return null;
    }
  }

  private async close(runId: number | null, started: number, status: SchedulerRunStatus, error: unknown): Promise<void> {
    if (runId === null) return;
    const finished = Date.now();
    try {
      await this.db.update(SchedulerRunJournal.TABLE, { id: runId }, {
        status: status.value,
        finished_at: new Date(finished),
        duration_ms: finished - started,
        error: error === null ? null : SchedulerRunJournal.message(error).slice(0, SchedulerRunJournal.ERROR_LIMIT),
      });
    } catch (writeError) {
      console.error('[scheduler]', `Could not record the end of run ${runId}: ${SchedulerRunJournal.message(writeError)}`);
    }
  }

  private static message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
