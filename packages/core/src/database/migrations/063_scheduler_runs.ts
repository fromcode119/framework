import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * What each background job did, and when.
 *
 * `_system_scheduler_tasks` keeps only when a task last ran and when it runs next; whether that run
 * worked, how long it took and what it failed with went to the process log and nowhere else, so
 * nobody looking at the console could tell what the platform was doing on its own. One row per run:
 * a task's whole pass (`parent_id` null), and, for a plugin task that runs once per site, one row
 * per site under it. Site-scoped as a journal (`TenantBespokePolicies`), which also adds `tenant_id`.
 */
export class SchedulerRunsMigration extends BaseMigration {
  readonly version = 63;
  readonly name = 'Scheduler runs';
  /** Only a new table and its index: the running release never reads it. */
  readonly rollingSafe = true;

  async up(db: IDatabaseManager): Promise<void> {
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(
      `CREATE TABLE IF NOT EXISTS _system_scheduler_runs (
        id ${type.autoId},
        task_name ${type.shortText} NOT NULL,
        plugin_slug ${type.shortText},
        parent_id INTEGER,
        status ${type.key} NOT NULL,
        started_at ${type.timestamp} DEFAULT ${type.now},
        finished_at ${type.timestamp},
        duration_ms INTEGER,
        error TEXT
      )`,
    ));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_scheduler_runs_task ON _system_scheduler_runs (task_name, started_at)'));
    await db.execute(Sql.raw('CREATE INDEX IF NOT EXISTS idx_scheduler_runs_parent ON _system_scheduler_runs (parent_id)'));
  }
}
