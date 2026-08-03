import { ScheduleType } from '@fromcode119/scheduler';

/**
 * The `context.scheduler` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextScheduler {
  /**
   * Register a task with a specific schedule (Cron or Interval)
   */
  register(name: string, schedule: string, handler: (data?: any) => Promise<void>, options?: { type?: ScheduleType }): Promise<void>;

  /**
   * Run a task immediately
   */
  runNow(name: string): Promise<void>;

  /**
   * Schedule a one-time task (conceptually, would likely enqueue a Job)
   */
  schedule(name: string, when: Date | string, data: any): Promise<void>;
}
