import { ScheduleType } from '@scheduler/enums/schedule-type.enum';
import type { ISchedulerTaskHandler } from '@scheduler/interfaces/scheduler-task-handler.interface';

export interface ISchedulerTask {
  name: string;
  schedule: string; // Cron syntax or interval string (e.g. "5m")
  type: ScheduleType;
  plugin_slug?: string;
  handler: ISchedulerTaskHandler;
  is_active: boolean;
  last_run?: Date;
  next_run?: Date;
}
