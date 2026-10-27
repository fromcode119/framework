import type { SchedulerService } from '@fromcode119/scheduler';
import type { IDatabaseManager } from '@fromcode119/database';

/**
 * Stops the scheduled tasks a running plugin no longer registers.
 *
 * A task row stays active until something stops it, and nothing did when a plugin release dropped a
 * task: the row read as due forever and each firing went to a handler that no longer existed (in a
 * plugin's own process, "guest: unknown handler" every ten minutes for days). Run after the plugins
 * have registered, for the plugins that did; registering the task again starts it again.
 */
export class PluginDroppedTaskSweep {
  static readonly TASKS_TABLE = '_system_scheduler_tasks';

  static async run(db: IDatabaseManager, scheduler: SchedulerService, pluginSlugs: string[]): Promise<string[]> {
    const owners = new Set(pluginSlugs);
    const rows = await db.find(PluginDroppedTaskSweep.TASKS_TABLE, { where: { is_active: true } });
    const dropped = (rows as Array<{ name: string; plugin_slug?: string | null }>)
      .filter((task) => Boolean(task.plugin_slug) && owners.has(String(task.plugin_slug)) && !scheduler.hasHandler(task.name))
      .map((task) => task.name);
    for (const name of dropped) await scheduler.unregister(name);
    return dropped;
  }
}
